import { Evaluator } from "../interpreter/Evaluator";
import { parser } from "../parser/parser"
import { Environment } from "../interpreter/Environment";
import { stdio } from "../clib/stdio";

// run the code
export const run = async (code: string): Promise<any> => {
  return await new Promise(
    (resolve: (value: any) => void, reject: (reason?: any) => void) => {
      const globalEnv: Environment = new Environment()
      const ev = new Evaluator()
      globalEnv.fndefine("printf", stdio.printf)
      const parsed = parser(code)
      console.log(parsed)
      const retval = ev.evaluate(parsed, globalEnv)
      var exitcode = ev.output + "Program exit with code:" + retval
      resolve(exitcode)
    }
  );
};