import { TreeNode } from "../ast/TreeNode";
import { Environment } from "./Environment";
import { StackFrame } from "./StackFrame";
import { RuntimeStack } from "./RuntimeStack";


//globalenv["printf"] = builtIn.printf;
const RTS: RuntimeStack = new RuntimeStack()

// stores final value from program

export class Evaluator {
    resultStack: any[] = [];
    output: any[] = []

    evaluate(node: TreeNode, env: Environment): any {
        switch(node.tag) {
            case 'Program':
              if (node.children?.stat) {
                    const stat = this.evaluate(node.children?.stat!, env)
                }
                if (node.children?.nextProg)
                    return this.evaluate(node.children?.nextProg, env)
    
                return this.evaluate(node.children!, env)
                
            case 'Statement':
                return this.evaluate(node.children!, env)
            case 'Def':
                return this.evaluate(node.children!, env)
            case 'IfStat':
                const condition: boolean = this.evaluate(node.condition!, env)
                const consequent = node.consequent!
                const alternative = node.alternative!
                if (condition)
                    return this.evaluate(consequent, env)
                else
                    return this.evaluate(alternative, env)
                break;
            case 'WhileStat': //FIXME: Not Yet Implemented
                const predicate: boolean = this.evaluate(node.predicate!, env)
                const body = node.body
                //TODO: update variable increment!!
                    // call again body again
                break;
            case 'Block':
                return this.evaluate(node.block!, env)
            case 'FunDef':
                
                const fnName = this.evaluate(node.children!.funcName!, env)
                    
                // Save the function definition to a environment
                const returnType = this.evaluate(node.children!.returnType!, env)
                const params = node.children?.args!.map(param => this.evaluate(param, env)) || []
                const bdy = node.children!.nextProg!
                const frame: StackFrame = {name: fnName, returnType, params, body: bdy, variables: {}}
                env.fndefine(fnName, frame)
    
                 // if it is the main function <= evaluate it, since its function definition is execution
                 if (fnName == 'main') { 
                    RTS.push(frame)
                    return this.evaluate(node.children!.nextProg!, env)
                    // RTS.pop(frame)
                }
                
                // Return undefined since we're not actually evaluating the function here
                return undefined;
    
            case 'FunCall':
                
                // do lookup of functions => if not present throw an error
                    // if present => map names to value and evaluate
                const fn_name:string = this.evaluate(node.funcName!, env)
    
                // map the value in the fn call to fn def params
                const fnCallParams = node.args!.map(param => this.evaluate(param, env)) || []
    
                if (fn_name == 'printf') { // check for builtIns
                    const pformat = this.evaluate(node.args![0], env).slice(1, -1)
                    const va = env.fnlookup(fn_name)(pformat, this.resultStack)
                    for (const item of va) {
                        this.output.push(item)
                    }
                    // this.output.push(va)
                    return undefined;
                }
    
                const fn = env.fnlookup(fn_name)
                if (!fn)
                    throw new Error(`Function ${node.funcName!.text!} is not defined`);
    
                
                const localEnv: Environment = env.extend()
                for (let i = 0; i < fn.params.length; i++) {
                    localEnv.fndefine(fn.params[i].varName, fnCallParams[i])
                }
    
                // add to RTS
                RTS.push(fn)
                const r = this.evaluate(fn.body!, localEnv)
                this.resultStack.push(r)
                RTS.pop()
                return r;
                
                break;
            case 'Return':
                return this.evaluate(node.children!, env)
            case 'UnaryExpression':
                const isAddr = this.evaluate(node.operator!, env)
                if (isAddr == true){
                    return env.getaddr(node.right!.text!)
                }
            case 'UnaryOp':
                return node.isAddressRefPresent;
            case 'BinaryExpression':
                const operator = this.evaluate(node.operator!, env);
                const left = this.evaluate(node.left!, env)
                const right = this.evaluate(node.right!, env)
                const result = this.binaryOp(operator, left,right)
                console.log(left)
                console.log(right)
                console.log(result)
                return result;
            case 'BinaryOp':
                return node.text!
            case 'Literal':
                const val = Number(node.text!)
                if (isNaN(val))
                    return node.text!
                return val
            case 'Identifier': // GET FROM ENVIRONMENT, FIXME: IMPROVE IT!
                // console.log(env.values)
                // console.log(env.fnvalues)
                // return env.fnvalues[node.text!]
                const funcId = env.fnlookup(node.text!)
                if (funcId !== undefined) return funcId
                const varId = env.lookup(node.text!)
                if (varId !== undefined) return varId
                throw Error("Identifier Error: Undefined Identifier")
                return env.fnvalues[node.text!]
            case 'returnType':
                return node.text!
            case 'FuncName':
                return node.text!
            case 'VarDef':
                
                if (node.children?.assignment) { // if there is an assignment
                    
                    const varType = this.evaluate(node.children!.type!, env)
                    const assignment = this.evaluate(node.children.assignment, env)
                    const varName = assignment.name
                    const isPointerPresent = assignment.isPointerPresent
                    const value = assignment.value
                    env.define(varName, value, varType)
                    return {varName, varType, isPointerPresent, value}
                }
                
                const varName = node.text!
                const varType = this.evaluate(node.children!.type!, env)
    
                return {varName, varType, value: undefined}
            
            case 'ArrDef':
                const type = this.evaluate(node.type!, env)
                const arr_name = node.text!
                const arrValues = node.arrValues!.map(val => this.evaluate(val, env));
                // perform ....
                break;
            case 'ArrAccess':
                const arrName = node.text!
                const index = node.arrIndex!
                // perform ...
                break;
            
            case 'Assignment':
                return {name: node.text!, 
                    isPointerPresent: node.isPointerPresent, 
                    value: this.evaluate(node.children!, env) }
            case 'Type':
                return node.text
            default:
                console.error(node)
                throw new Error(`Unknown AST node type: ${node!}`)
        }
    }

    unaryOp(operator: string, vname: any) {

    }
    
    binaryOp(operator: string, left: number, right: number) {
        switch (operator) {
            case '+':
              return left + right;
            case '-':
              return left - right;
            case '*':
              return left * right;
            case '/':
              return left / right;
            case '%':
              return left % right;
            case '==':
              return left === right;
            case '!=':
              return left !== right;
            case '<':
              return left < right;
            case '>':
              return left > right;
            case '<=':
              return left <= right;
            case '>=':
              return left >= right;
            default:
              throw new Error(`Unknown operator:`);
          }
    }
}


