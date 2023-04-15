export const stdio = {
    printf: (format: string,args: any[]) => 
    {
        const rawFormat = String.raw`${format}`;
        const regex_p = /%[diufFeEgGxXoscpaAn]/g;
        const regMatch = rawFormat.match(regex_p)
        let output: any[] = [];
        let index = 0;
        let regVar: any = null;
        
        // Check Validity
        if (regMatch?.length === 0 || args.length === 0) {
            output.push(rawFormat)
            return output
        }
        console.log(regMatch)
        console.log(args)
        if (regMatch?.length !== args.length) throw Error("PrintfError: args number mismatch")
        let validity = true;
        for (const factor in regMatch)
        {
            switch(factor) {
                case "%d":
                    regVar = args[index++]
                    if (typeof regVar !== "number" && !Number.isInteger(regVar)){
                        validity = false
                        break
                    }
            }
        }

        index = 0;
        output.push(rawFormat.replace(regex_p, function(match) { return args[index++]}))
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