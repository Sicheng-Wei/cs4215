import { Evaluator } from "../interpreter/Evaluator";
import { parser } from "../parser/parser"
import { Environment } from "../interpreter/Environment";
import { stdio } from "../clib/stdio";

// run the code
export const run = async (code: string): Promise<any> => {
  const globalEnv: Environment = new Environment()
  const ev = new Evaluator()
  globalEnv.fndefine("printf", stdio.printf)
  const parsed = parser(code)

  // evaluate & output
  const retval = ev.evaluate(parsed, globalEnv)
  ev.output.push("Program exit code: " + retval)
  var exitcode = ev.output

  return await new Promise(
    (resolve, reject) => {
      resolve(exitcode)
    }
  );
};