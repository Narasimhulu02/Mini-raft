# Compiler Exercises PE3-PE5 (Flex/Bison)

This folder contains independent implementations for:

- PE3: Symbol table construction for a C-like subset.
- PE4: Expression evaluation with symbol table updates and semantic checks.
- PE5: AST construction for arithmetic expressions with postorder output.

## Prerequisites

- `flex`
- `bison`
- `gcc`

## Build

```powershell
cd compiler_exercises
make all
```

Or build one exercise:

```powershell
make pe3
make pe4
make pe5
```

## Run

### PE3 Symbol Table

```powershell
.\pe3.exe pe3_sample.c
```

Output: tabular symbol table with name, kind, type, storage, size, scope, definition location, initializer, use-sites.

### PE4 Expression Evaluation

```powershell
.\pe4.exe pe4_sample.txt
```

Sample input includes:

- declarations
- assignments
- arithmetic expressions
- `.` as optional terminator

Checks:

- variable not declared
- variable used before initialization
- type mismatch in assignment/initialization
- division by zero

### PE5 AST + Postorder (RPN)

```powershell
.\pe5.exe pe5_sample.txt
```

Each expression line prints postorder traversal.

## Example PE4

Input:

```text
int a=5, b=8, c=9, d;
d=a+b*c.
```

Expected `d` value is 77.

## Clean

```powershell
make clean
```
