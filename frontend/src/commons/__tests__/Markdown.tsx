import { mount } from 'enzyme';
import { Chapter, Variant } from 'js-slang/dist/types';

import Markdown from '../Markdown';
import { generateSourceIntroduction } from '../utils/IntroductionHelper';

const mockProps = (sourceChapter: Chapter, sourceVariant: Variant) => {
  return {
    content: generateSourceIntroduction(sourceChapter, sourceVariant),
    openLinksInNewWindow: true
  };
};

test('Markdown page renders correctly', () => {
  const app = <Markdown {...mockProps(Chapter.SOURCE_1, Variant.DEFAULT)} />;
  const tree = mount(app);
  expect(tree.debug()).toMatchSnapshot();
});
