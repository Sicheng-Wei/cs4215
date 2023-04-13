export const stdio = {
    printf: (format: string,args: any[]) => 
    {
        let index = 0;
        let output = "";
        for (let i = 0; i < format.length; i++)
        {
            if (format[i] === "%") 
            {
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
            } 
            else output += format[i];
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