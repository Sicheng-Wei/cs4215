import { evaluate } from "../interpreter/Evaluator";
import { parser } from "../parser/parser"
import { Environment } from "../interpreter/Environment";

// intepret program
export const run = async (code: string): Promise<any> => {
  return await new Promise(
    (resolve: (value: any) => void, reject: (reason?: any) => void) => {
      const globalEnv: Environment = new Environment();

      const builtIn = {
        printf: (format: string,args: any[]) => {
            let index = 0;
        let output = "";
        for (let i = 0; i < format.length; i++) {
          if (format[i] === "%") {
            const specifier = format[i + 1];
            switch (specifier) {
              case "d":
                output += args[index++];
                break;
              case "s":
                output += args[index++];
                break;
              case "c":
                output += String.fromCharCode(args[index++]);
                break;
              default:
                throw new Error(`Invalid format specifier: ${specifier}`);
            }
            i++; // Skip over the specifier
          } else {
            output += format[i];
          }
        }
      
        console.log(output);
        }
    }
      globalEnv.define("printf", builtIn.printf)
      const parsed = parser(code)
      var exitcode = 'Program exit with code:' + evaluate(parsed, globalEnv)
      resolve(exitcode)
    }
  );
};