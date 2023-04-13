import { evaluate } from "../interpreter/Evaluator";
import { parser } from "../parser/parser"

// intepret program
export const run = async (code: string): Promise<any> => {
  return await new Promise(
    (resolve: (value: any) => void, reject: (reason?: any) => void) => {
      const parsed = parser(code)
      var exitcode = 'Program exit with code:' + evaluate(parsed)
      resolve(exitcode)
    }
  );
};