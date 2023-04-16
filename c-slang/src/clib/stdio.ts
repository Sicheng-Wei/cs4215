export const stdio = {
    printf: (format: string,args: any[]) => 
    {
        let output: any[] = [];
        const rawFormat = String.raw`${format}`;
        let index = 0;

        // C Specifier Regex
        const regex_spec = /%[diufFeEgGxXoscpaAn]/g;
        const regMatch = rawFormat.match(regex_spec)
        console.log(regMatch)
        console.log(args[0])
        let regVar: any = null;
        
        // Check Validity
        if (regMatch?.length === 0 || args.length === 0) {
            output.push(rawFormat)
            return output
        }
        if (regMatch?.length !== args.length) throw Error("PrintfError: Args Number Mismatch")
        let validity = true;
        for (let i = 0; i < regMatch.length; i++)
        {
            switch(regMatch[i]) {
                case "%d":
                    regVar = args[index++]
                    if (typeof regVar !== "number" && !Number.isInteger(regVar)) validity = false
                    break
                default:
                    throw Error("PrintfError: Unknown Specifier")
            }
            if (validity == false) throw Error("PrintfError: Args Type Mismatch")
        }

        index = 0;
        const specFormat = rawFormat.replace(regex_spec, function() { return args[index++]})

        // C Delimiter Regex
        const regex_deli = /\\[tr]/g
        const deliFormat = specFormat

        // C LineFeed Regex
        const regex_lf = /\\[n]/g
        let lfMatch
        let lfMatchId: number[] = []
        while (lfMatch = regex_lf.exec(deliFormat)) {
            lfMatchId.push(lfMatch.index)
        }
        const lfStack = splitStringByIndices(deliFormat, lfMatchId)
        let lfPtr
        for (let i = 0; i < lfStack.length; i++) {
            lfPtr = lfStack[i]
            if (i >= 1) output.push(lfPtr.slice(2, -1))
            else output.push(lfPtr)
        }
        return output
    },

    typeSize: (typeName: string) => {
        var typeSizeMap: {[key: string]: number} = {
            "void": 32,
            "int":  32,
            "char": 32,
            "void*":32,
            "int*": 32,
            "char*":32
        }
        return typeSizeMap[typeName]
    }
}


function splitStringByIndices(str: string, indices: number[]): string[] {
    const splitIndices = [0, ...indices, str.length];
    const result: string[] = [];
  
    for (let i = 0; i < splitIndices.length - 1; i++) {
      const start = splitIndices[i];
      const end = splitIndices[i + 1];
      result.push(str.substring(start, end));
    }
    return result;
  }