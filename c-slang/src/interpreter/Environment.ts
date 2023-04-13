import { stdio } from "../clib/stdio";

export class Environment {
    // variable mapping
    values: { [key: string]: any } = {};
    address: { [key: string]: number } = {};

    // function mapping
    fnvalues: { [key: string]: any } = {};

    private parentEnv?: Environment;
    private baseid = 1e9 + Math.floor(Math.random() * 8e9);
  
    constructor(parentEnv?: Environment) {
      this.parentEnv = parentEnv;
    }
    
    lookup(name: string): any {
      if (name in this.values) {
        return this.values[name];
      } else if (this.parentEnv) {
        return this.parentEnv.lookup(name);
      } else {
        throw new Error(`Undefined variable ${name}`);
      }
    }

    getaddr(name: string): any{
      if (name in this.address) {
        return this.address[name];
      } else if (this.parentEnv) {
        return this.parentEnv.getaddr(name);
      } else {
        throw new Error(`Undefined variable ${name}`);
      }
    }

    fnlookup(name: string): any {
      if (name in this.fnvalues) {
        return this.fnvalues[name];
      } else if (this.parentEnv) {
        return this.parentEnv.fnlookup(name);
      } else {
        throw new Error(`Undefined function ${name}`);
      }
    }
  
    define(name: string, value: any, varType: any): void {
      this.values[name] = value;
      this.address[name] = this.baseid;
      this.baseid += stdio.typeSize(varType)
    }

    fndefine(name: string, value: any): void {
      this.fnvalues[name] = value;
    }
  
    extend(): Environment {
      return new Environment(this);
    }
  }