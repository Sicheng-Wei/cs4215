### Simple Calculation

```C
int val(int a){
    return a * 3 + 2;
}

int main(){
  printf("%d", val(4));
  return 0;
}

```

```
Output: "\"14\"Program exit with code:0"
```



### Sum

```C
int sum(int x, int y) {
    return x + y;
}

int main() { 
    printf("%d %d", sum(7,3), sum(6,8)); 
    return 0;
}

```

```
Output: "\"14 10\"Program exit with code:0"
```



### Recursion

```C
int val(int a){
    if(a > 100){
        return a;
    }else{
        return val(a + 1);
    }
}

int main(){
  printf("%d", val(4));
  return 0;
}
```

```
Output: "\"101\"Program exit with code:0"
```



### Frontend Stack Overflow

```C
int val(int a){
    if(a > 1000){
        return a;
    }else{
        return val(a + 1);
    }
}

int main(){
  printf("%d", val(4));
  return 0;
}
```

```
Output: Maximum call stack size exceeded
```



### Address

```C
int main() { 
    int a = 1;
    &a;
}
```

```
Output: Maximum call stack size exceeded
```

