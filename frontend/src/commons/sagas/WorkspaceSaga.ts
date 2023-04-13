import { FSModule } from 'browserfs/dist/node/core/FS';
import { run } from 'c-slang';
import { Context, findDeclaration, getNames } from 'js-slang';
import { defineSymbol } from 'js-slang/dist/createContext';
import { Chapter, Variant } from 'js-slang/dist/types';
import Phaser from 'phaser';
import { SagaIterator } from 'redux-saga';
import { call, put, select, StrictEffect, take } from 'redux-saga/effects';
import EnvVisualizer from 'src/features/envVisualizer/EnvVisualizer';

import { EventType } from '../../features/achievement/AchievementTypes';
import DataVisualizer from '../../features/dataVisualizer/dataVisualizer';
import { WORKSPACE_BASE_PATHS } from '../../pages/fileSystem/createInBrowserFileSystem';
import {
  defaultEditorValue,
  OverallState,
  styliseSublanguage
} from '../application/ApplicationTypes';
import { externalLibraries, ExternalLibraryName } from '../application/types/ExternalTypes';
import {
  DEBUG_RESET,
  DEBUG_RESUME,
  UPDATE_EDITOR_HIGHLIGHTED_LINES
} from '../application/types/InterpreterTypes';
import { Library } from '../assessment/AssessmentTypes';
import { Documentation } from '../documentation/Documentation';
import { writeFileRecursively } from '../fileSystem/utils';
import { actions } from '../utils/ActionsHelper';
import DisplayBufferService from '../utils/DisplayBufferService';
import {
  getBlockExtraMethodsString,
  getDifferenceInMethods,
  getRestoreExtraMethodsString,
  getStoreExtraMethodsString,
  highlightClean,
  highlightLine
} from '../utils/JsSlangHelper';
import { showSuccessMessage, showWarningMessage } from '../utils/NotificationsHelper';
import { showFullJSDisclaimer, showFullTSDisclaimer } from '../utils/WarningDialogHelper';
import { notifyProgramEvaluated } from '../workspace/WorkspaceActions';
import {
  ADD_HTML_CONSOLE_ERROR,
  BEGIN_CLEAR_CONTEXT,
  CHAPTER_SELECT,
  EditorTabState,
  END_CLEAR_CONTEXT,
  EVAL_EDITOR,
  EVAL_REPL,
  EVAL_SILENT,
  NAV_DECLARATION,
  PLAYGROUND_EXTERNAL_SELECT,
  PROMPT_AUTOCOMPLETE,
  SET_FOLDER_MODE,
  TOGGLE_EDITOR_AUTORUN,
  TOGGLE_FOLDER_MODE,
  UPDATE_EDITOR_VALUE,
  WorkspaceLocation
} from '../workspace/WorkspaceTypes';
import { safeTakeEvery as takeEvery } from './SafeEffects';

export default function* WorkspaceSaga(): SagaIterator {
  let context: Context;

  yield takeEvery(
    ADD_HTML_CONSOLE_ERROR,
    function* (action: ReturnType<typeof actions.addHtmlConsoleError>) {
      yield put(
        actions.handleConsoleLog(action.payload.workspaceLocation, action.payload.errorMsg)
      );
    }
  );

  yield takeEvery(
    TOGGLE_FOLDER_MODE,
    function* (action: ReturnType<typeof actions.toggleFolderMode>) {
      const workspaceLocation = action.payload.workspaceLocation;
      const isFolderModeEnabled: boolean = yield select(
        (state: OverallState) => state.workspaces[workspaceLocation].isFolderModeEnabled
      );
      yield put(actions.setFolderMode(workspaceLocation, !isFolderModeEnabled));
      const warningMessage = `Folder mode ${!isFolderModeEnabled ? 'enabled' : 'disabled'}`;
      yield call(showWarningMessage, warningMessage, 750);
    }
  );

  yield takeEvery(SET_FOLDER_MODE, function* (action: ReturnType<typeof actions.setFolderMode>) {
    const workspaceLocation = action.payload.workspaceLocation;
    const isFolderModeEnabled: boolean = yield select(
      (state: OverallState) => state.workspaces[workspaceLocation].isFolderModeEnabled
    );
    // Do nothing if Folder mode is enabled.
    if (isFolderModeEnabled) {
      return;
    }

    const editorTabs: EditorTabState[] = yield select(
      (state: OverallState) => state.workspaces[workspaceLocation].editorTabs
    );
    // If Folder mode is disabled and there are no open editor tabs, add an editor tab.
    if (editorTabs.length === 0) {
      const defaultFilePath = `${WORKSPACE_BASE_PATHS[workspaceLocation]}/program.js`;
      const fileSystem: FSModule | null = yield select(
        (state: OverallState) => state.fileSystem.inBrowserFileSystem
      );
      // If the file system is not initialised, add an editor tab with the default editor value.
      if (fileSystem === null) {
        yield put(actions.addEditorTab(workspaceLocation, defaultFilePath, defaultEditorValue));
        return;
      }
      const editorValue: string = yield new Promise((resolve, reject) => {
        fileSystem.exists(defaultFilePath, fileExists => {
          if (!fileExists) {
            // If the file does not exist, we need to also create it in the file system.
            writeFileRecursively(fileSystem, defaultFilePath, defaultEditorValue)
              .then(() => resolve(defaultEditorValue))
              .catch(err => reject(err));
            return;
          }
          fileSystem.readFile(defaultFilePath, 'utf-8', (err, fileContents) => {
            if (err) {
              reject(err);
              return;
            }
            if (fileContents === undefined) {
              reject(new Error('File exists but has no contents.'));
              return;
            }
            resolve(fileContents);
          });
        });
      });
      yield put(actions.addEditorTab(workspaceLocation, defaultFilePath, editorValue));
    }
  });

  // Mirror editor updates to the associated file in the filesystem.
  yield takeEvery(
    UPDATE_EDITOR_VALUE,
    function* (action: ReturnType<typeof actions.updateEditorValue>) {
      const workspaceLocation = action.payload.workspaceLocation;
      const editorTabIndex = action.payload.editorTabIndex;

      const filePath: string | undefined = yield select(
        (state: OverallState) =>
          state.workspaces[workspaceLocation].editorTabs[editorTabIndex].filePath
      );
      // If the code does not have an associated file, do nothing.
      if (filePath === undefined) {
        return;
      }

      const fileSystem: FSModule | null = yield select(
        (state: OverallState) => state.fileSystem.inBrowserFileSystem
      );
      // If the file system is not initialised, do nothing.
      if (fileSystem === null) {
        return;
      }

      fileSystem.writeFile(filePath, action.payload.newEditorValue, err => {
        if (err) {
          console.error(err);
        }
      });
      yield;
    }
  );

  yield takeEvery(EVAL_EDITOR, function* (action: ReturnType<typeof actions.evalEditor>) {
    const workspaceLocation = action.payload.workspaceLocation;
    yield* evalEditor(workspaceLocation);
  });

  yield takeEvery(
    PROMPT_AUTOCOMPLETE,
    function* (action: ReturnType<typeof actions.promptAutocomplete>): any {
      const workspaceLocation = action.payload.workspaceLocation;

      context = yield select((state: OverallState) => state.workspaces[workspaceLocation].context);

      const code: string = yield select((state: OverallState) => {
        const prependCode = state.workspaces[workspaceLocation].programPrependValue;
        // TODO: Hardcoded to make use of the first editor tab. Rewrite after editor tabs are added.
        const editorCode = state.workspaces[workspaceLocation].editorTabs[0].value;
        return [prependCode, editorCode] as [string, string];
      });
      const [prepend, editorValue] = code;

      // Deal with prepended code
      let autocompleteCode;
      let prependLength = 0;
      if (!prepend) {
        autocompleteCode = editorValue;
      } else {
        prependLength = prepend.split('\n').length;
        autocompleteCode = prepend + '\n' + editorValue;
      }

      const [editorNames, displaySuggestions] = yield call(
        getNames,
        autocompleteCode,
        action.payload.row + prependLength,
        action.payload.column,
        context
      );

      if (!displaySuggestions) {
        yield call(action.payload.callback);
        return;
      }

      const editorSuggestions = editorNames.map((name: any) => {
        return {
          ...name,
          caption: name.name,
          value: name.name,
          score: name.score ? name.score + 1000 : 1000, // Prioritize suggestions from code
          name: undefined
        };
      });

      let chapterName = context.chapter.toString();
      const variant = context.variant ?? Variant.DEFAULT;
      if (variant !== Variant.DEFAULT) {
        chapterName += '_' + variant;
      }

      const builtinSuggestions = Documentation.builtins[chapterName] || [];

      const extLib = yield select(
        (state: OverallState) => state.workspaces[workspaceLocation].externalLibrary
      );

      const extLibSuggestions = Documentation.externalLibraries[extLib] || [];

      yield call(
        action.payload.callback,
        null,
        editorSuggestions.concat(builtinSuggestions, extLibSuggestions)
      );
    }
  );

  yield takeEvery(
    TOGGLE_EDITOR_AUTORUN,
    function* (action: ReturnType<typeof actions.toggleEditorAutorun>): any {
      const workspaceLocation = action.payload.workspaceLocation;
      const isEditorAutorun = yield select(
        (state: OverallState) => state.workspaces[workspaceLocation].isEditorAutorun
      );
      yield call(showWarningMessage, 'Autorun ' + (isEditorAutorun ? 'Started' : 'Stopped'), 750);
    }
  );

  yield takeEvery(EVAL_REPL, function* (action: ReturnType<typeof actions.evalRepl>) {
    const workspaceLocation = action.payload.workspaceLocation;
    const code: string = yield select(
      (state: OverallState) => state.workspaces[workspaceLocation].replValue
    );
    const execTime: number = yield select(
      (state: OverallState) => state.workspaces[workspaceLocation].execTime
    );
    yield put(actions.beginInterruptExecution(workspaceLocation));
    yield put(actions.clearReplInput(workspaceLocation));
    yield put(actions.sendReplInputToOutput(code, workspaceLocation));
    yield call(evalCode, code, execTime, workspaceLocation, EVAL_REPL);
  });

  yield takeEvery(DEBUG_RESUME, function* (action: ReturnType<typeof actions.debuggerResume>) {
    const workspaceLocation = action.payload.workspaceLocation;
    const code: string = yield select(
      // TODO: Hardcoded to make use of the first editor tab. Rewrite after editor tabs are added.
      (state: OverallState) => state.workspaces[workspaceLocation].editorTabs[0].value
    );
    const execTime: number = yield select(
      (state: OverallState) => state.workspaces[workspaceLocation].execTime
    );
    yield put(actions.beginInterruptExecution(workspaceLocation));
    /** Clear the context, with the same chapter and externalSymbols as before. */
    yield put(actions.clearReplOutput(workspaceLocation));
    // TODO: Hardcoded to make use of the first editor tab. Rewrite after editor tabs are added.
    yield put(actions.setEditorHighlightedLines(workspaceLocation, 0, []));
    yield call(evalCode, code, execTime, workspaceLocation, DEBUG_RESUME);
  });

  yield takeEvery(DEBUG_RESET, function* (action: ReturnType<typeof actions.debuggerReset>) {
    const workspaceLocation = action.payload.workspaceLocation;
    context = yield select((state: OverallState) => state.workspaces[workspaceLocation].context);
    yield put(actions.clearReplOutput(workspaceLocation));
    // TODO: Hardcoded to make use of the first editor tab. Rewrite after editor tabs are added.
    yield put(actions.setEditorHighlightedLines(workspaceLocation, 0, []));
    context.runtime.break = false;
  });

  yield takeEvery(
    UPDATE_EDITOR_HIGHLIGHTED_LINES,
    function* (action: ReturnType<typeof actions.setEditorHighlightedLines>) {
      const newHighlightedLines = action.payload.newHighlightedLines;
      if (newHighlightedLines.length === 0) {
        highlightClean();
      } else {
        newHighlightedLines.forEach(([startRow, _endRow]: [number, number]) =>
          highlightLine(startRow)
        );
      }
      yield;
    }
  );

  yield takeEvery(CHAPTER_SELECT, function* (action: ReturnType<typeof actions.chapterSelect>) {
    const { workspaceLocation, chapter: newChapter, variant: newVariant } = action.payload;
    const [oldVariant, oldChapter, symbols, globals, externalLibraryName]: [
      Variant,
      Chapter,
      string[],
      Array<[string, any]>,
      ExternalLibraryName
    ] = yield select((state: OverallState) => [
      state.workspaces[workspaceLocation].context.variant,
      state.workspaces[workspaceLocation].context.chapter,
      state.workspaces[workspaceLocation].context.externalSymbols,
      state.workspaces[workspaceLocation].globals,
      state.workspaces[workspaceLocation].externalLibrary
    ]);

    const chapterChanged: boolean = newChapter !== oldChapter || newVariant !== oldVariant;
    const toChangeChapter: boolean =
      newChapter === Chapter.FULL_JS
        ? chapterChanged && (yield call(showFullJSDisclaimer))
        : newChapter === Chapter.FULL_TS
        ? chapterChanged && (yield call(showFullTSDisclaimer))
        : chapterChanged;

    if (toChangeChapter) {
      const library: Library = {
        chapter: newChapter,
        variant: newVariant,
        external: {
          name: externalLibraryName,
          symbols
        },
        globals
      };
      yield put(actions.beginClearContext(workspaceLocation, library, false));
      yield put(actions.clearReplOutput(workspaceLocation));
      yield put(actions.debuggerReset(workspaceLocation));
      yield call(
        showSuccessMessage,
        `Switched to ${styliseSublanguage(newChapter, newVariant)}`,
        1000
      );
    }
  });

  /**
   * Note that the PLAYGROUND_EXTERNAL_SELECT action is made to
   * select the library for playground.
   * This is because assessments do not have a chapter & library select, the question
   * specifies the chapter and library to be used.
   *
   * To abstract this to assessments, the state structure must be manipulated to store
   * the external library name in a WorkspaceState (as compared to IWorkspaceManagerState).
   *
   * @see IWorkspaceManagerState @see WorkspaceState
   */
  yield takeEvery(
    PLAYGROUND_EXTERNAL_SELECT,
    function* (action: ReturnType<typeof actions.externalLibrarySelect>) {
      const { workspaceLocation, externalLibraryName: newExternalLibraryName } = action.payload;
      const [chapter, globals, oldExternalLibraryName]: [
        Chapter,
        Array<[string, any]>,
        ExternalLibraryName
      ] = yield select((state: OverallState) => [
        state.workspaces[workspaceLocation].context.chapter,
        state.workspaces[workspaceLocation].globals,
        state.workspaces[workspaceLocation].externalLibrary
      ]);
      const symbols = externalLibraries.get(newExternalLibraryName)!;
      const library: Library = {
        chapter,
        external: {
          name: newExternalLibraryName,
          symbols
        },
        globals
      };
      if (newExternalLibraryName !== oldExternalLibraryName || action.payload.initialise) {
        yield put(actions.changeExternalLibrary(newExternalLibraryName, workspaceLocation));
        yield put(actions.beginClearContext(workspaceLocation, library, true));
        yield put(actions.clearReplOutput(workspaceLocation));
        if (!action.payload.initialise) {
          yield call(showSuccessMessage, `Switched to ${newExternalLibraryName} library`, 1000);
        }
      }
    }
  );

  /**
   * Handles the side effect of resetting the WebGL context when context is reset.
   *
   * @see webGLgraphics.js under 'public/externalLibs/graphics' for information on
   * the function.
   */
  yield takeEvery(
    BEGIN_CLEAR_CONTEXT,
    function* (action: ReturnType<typeof actions.beginClearContext>) {
      DataVisualizer.clear();
      EnvVisualizer.clear();
      const globals: Array<[string, any]> = action.payload.library.globals as Array<[string, any]>;
      for (const [key, value] of globals) {
        window[key] = value;
      }
      yield put(
        actions.endClearContext(
          {
            ...action.payload.library,
            moduleParams: {
              runes: {},
              phaser: Phaser
            }
          },
          action.payload.workspaceLocation
        )
      );
      yield undefined;
    }
  );

  yield takeEvery(
    NAV_DECLARATION,
    function* (action: ReturnType<typeof actions.navigateToDeclaration>) {
      const workspaceLocation = action.payload.workspaceLocation;
      const code: string = yield select(
        // TODO: Hardcoded to make use of the first editor tab. Rewrite after editor tabs are added.
        (state: OverallState) => state.workspaces[workspaceLocation].editorTabs[0].value
      );
      context = yield select((state: OverallState) => state.workspaces[workspaceLocation].context);

      const result = findDeclaration(code, context, {
        line: action.payload.cursorPosition.row + 1,
        column: action.payload.cursorPosition.column
      });
      if (result) {
        // TODO: Hardcoded to make use of the first editor tab. Rewrite after editor tabs are added.
        yield put(
          actions.moveCursor(action.payload.workspaceLocation, 0, {
            row: result.start.line - 1,
            column: result.start.column
          })
        );
      }
    }
  );
}

function* clearContext(workspaceLocation: WorkspaceLocation, entrypointCode: string) {
  const [chapter, symbols, externalLibraryName, globals, variant]: [
    number,
    string[],
    ExternalLibraryName,
    Array<[string, any]>,
    Variant
  ] = yield select((state: OverallState) => [
    state.workspaces[workspaceLocation].context.chapter,
    state.workspaces[workspaceLocation].context.externalSymbols,
    state.workspaces[workspaceLocation].externalLibrary,
    state.workspaces[workspaceLocation].globals,
    state.workspaces[workspaceLocation].context.variant
  ]);

  const library = {
    chapter,
    variant,
    external: {
      name: externalLibraryName,
      symbols
    },
    globals
  };

  // Clear the context, with the same chapter and externalSymbols as before.
  yield put(actions.beginClearContext(workspaceLocation, library, false));
  // Wait for the clearing to be done.
  yield take(END_CLEAR_CONTEXT);

  const context: Context = yield select(
    (state: OverallState) => state.workspaces[workspaceLocation].context
  );
  defineSymbol(context, '__PROGRAM__', entrypointCode);
}

export function* dumpDisplayBuffer(
  workspaceLocation: WorkspaceLocation
): Generator<StrictEffect, void, any> {
  yield put(actions.handleConsoleLog(workspaceLocation, ...DisplayBufferService.dump()));
}

export function* evalEditor(
  workspaceLocation: WorkspaceLocation
): Generator<StrictEffect, void, any> {
  const [code, execTime]: [string, number] = yield select((state: OverallState) => [
    state.workspaces[workspaceLocation].editorTabs[0].value,
    state.workspaces[workspaceLocation].execTime
  ]);

  yield put(actions.addEvent([EventType.RUN_CODE]));

  // End any code that is running right now.
  yield put(actions.beginInterruptExecution(workspaceLocation));
  yield* clearContext(workspaceLocation, code);
  yield put(actions.clearReplOutput(workspaceLocation));

  yield call(evalCode, code, execTime, workspaceLocation, EVAL_EDITOR);
}

export function* blockExtraMethods(
  elevatedContext: Context,
  context: Context,
  execTime: number,
  workspaceLocation: WorkspaceLocation,
  unblockKey?: string
) {
  // Extract additional methods available in the elevated context relative to the context
  const toBeBlocked = getDifferenceInMethods(elevatedContext, context);
  if (unblockKey) {
    const storeValues = getStoreExtraMethodsString(toBeBlocked, unblockKey);
    yield call(evalCode, storeValues, execTime, workspaceLocation, EVAL_SILENT);
  }

  const nullifier = getBlockExtraMethodsString(toBeBlocked);
  yield call(evalCode, nullifier, execTime, workspaceLocation, EVAL_SILENT);
}

export function* restoreExtraMethods(
  elevatedContext: Context,
  context: Context,
  execTime: number,
  workspaceLocation: WorkspaceLocation,
  unblockKey: string
) {
  const toUnblock = getDifferenceInMethods(elevatedContext, context);
  const restorer = getRestoreExtraMethodsString(toUnblock, unblockKey);
  yield call(evalCode, restorer, execTime, workspaceLocation, EVAL_SILENT);
}

export function* evalCode(
  code: string,
  execTime: number,
  workspaceLocation: WorkspaceLocation,
  actionType: string
): SagaIterator {
  try {
    const result = yield call(run, code);
    yield put(notifyProgramEvaluated(result, code, workspaceLocation));
    if (actionType !== EVAL_SILENT) {
      yield put(actions.evalInterpreterSuccess(result, workspaceLocation));
    }
  } catch (err) {
    yield put(actions.addEvent([EventType.ERROR]));
    yield put(actions.evalInterpreterError(err, workspaceLocation));
  }
}
