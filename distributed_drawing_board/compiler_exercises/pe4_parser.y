%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int yylex(void);
void yyerror(const char *s);

extern int yylineno;
extern char *yytext;
extern FILE *yyin;

typedef enum {
    T_INT,
    T_FLOAT,
    T_DOUBLE,
    T_CHAR,
    T_UNKNOWN
} ValueType;

typedef struct {
    char name[64];
    ValueType type;
    double value;
    int has_value;
} Entry;

typedef struct {
    ValueType type;
    double value;
    int ok;
} ExprValue;

static Entry table_data[512];
static int table_count = 0;

static ValueType current_decl_type = T_UNKNOWN;
static int had_error = 0;

static const char *type_to_str(ValueType t)
{
    switch (t) {
        case T_INT: return "int";
        case T_FLOAT: return "float";
        case T_DOUBLE: return "double";
        case T_CHAR: return "char";
        default: return "unknown";
    }
}

static int find_symbol(const char *name)
{
    int i;
    for (i = table_count - 1; i >= 0; --i) {
        if (strcmp(table_data[i].name, name) == 0) return i;
    }
    return -1;
}

static int add_symbol(const char *name, ValueType type)
{
    if (find_symbol(name) >= 0) {
        fprintf(stderr, "PE4 error (line %d): redeclaration of %s\n", yylineno, name);
        had_error = 1;
        return -1;
    }
    strncpy(table_data[table_count].name, name, sizeof(table_data[table_count].name) - 1);
    table_data[table_count].type = type;
    table_data[table_count].value = 0.0;
    table_data[table_count].has_value = 0;
    return table_count++;
}

static ValueType merge_type(ValueType a, ValueType b)
{
    if (a == T_UNKNOWN || b == T_UNKNOWN) return T_UNKNOWN;
    if (a == T_DOUBLE || b == T_DOUBLE) return T_DOUBLE;
    if (a == T_FLOAT || b == T_FLOAT) return T_FLOAT;
    if (a == T_INT || b == T_INT) return T_INT;
    return T_CHAR;
}

static int assignment_compatible(ValueType lhs, ValueType rhs)
{
    if (lhs == rhs) return 1;
    if ((lhs == T_DOUBLE || lhs == T_FLOAT) && (rhs == T_INT || rhs == T_CHAR)) return 1;
    if (lhs == T_INT && rhs == T_CHAR) return 1;
    return 0;
}

static ExprValue make_val(ValueType t, double v, int ok)
{
    ExprValue e;
    e.type = t;
    e.value = v;
    e.ok = ok;
    return e;
}

static void print_table(void)
{
    int i;
    printf("\n%-12s %-10s %-12s\n", "Name", "Type", "Value");
    printf("%-12s %-10s %-12s\n", "------------", "----------", "------------");
    for (i = 0; i < table_count; ++i) {
        if (table_data[i].has_value) {
            if (table_data[i].type == T_INT || table_data[i].type == T_CHAR) {
                printf("%-12s %-10s %-12d\n", table_data[i].name, type_to_str(table_data[i].type), (int)table_data[i].value);
            } else {
                printf("%-12s %-10s %-12.6f\n", table_data[i].name, type_to_str(table_data[i].type), table_data[i].value);
            }
        } else {
            printf("%-12s %-10s %-12s\n", table_data[i].name, type_to_str(table_data[i].type), "uninit");
        }
    }
}
%}

%union {
    char *str;
    ExprValue expr;
    ValueType vtype;
}

%token <str> ID
%token <expr> NUM
%token INT FLOAT DOUBLE CHAR

%type <vtype> type_spec
%type <expr> expr term factor

%left '+' '-'
%left '*' '/'

%start program

%%

program
    : stmts terminator_opt
      {
          if (!had_error) {
              printf("PE4 evaluation completed.\n");
              print_table();
          }
      }
    ;

terminator_opt
    :
    | '.'
    ;

stmts
    : stmt
    | stmts sep stmt
    ;

sep
    : ','
    | ';'
    ;

stmt
    : declaration
    | assignment
    ;

declaration
    : type_spec { current_decl_type = $1; } decl_list
    ;

decl_list
    : decl_item
    | decl_list ',' decl_item
    ;

decl_item
    : ID
      {
          add_symbol($1, current_decl_type);
          free($1);
      }
    | ID '=' expr
      {
          int idx = add_symbol($1, current_decl_type);
          if (idx >= 0 && $3.ok) {
              if (!assignment_compatible(table_data[idx].type, $3.type)) {
                  fprintf(stderr, "PE4 error (line %d): type mismatch in initialization of %s (lhs=%s rhs=%s)\n", yylineno, $1, type_to_str(table_data[idx].type), type_to_str($3.type));
                  had_error = 1;
              } else {
                  table_data[idx].value = $3.value;
                  table_data[idx].has_value = 1;
              }
          }
          free($1);
      }
    ;

assignment
    : ID '=' expr
      {
          int idx = find_symbol($1);
          if (idx < 0) {
              fprintf(stderr, "PE4 error (line %d): variable '%s' not declared\n", yylineno, $1);
              had_error = 1;
          } else if ($3.ok) {
              if (!assignment_compatible(table_data[idx].type, $3.type)) {
                  fprintf(stderr, "PE4 error (line %d): type mismatch in assignment to %s (lhs=%s rhs=%s)\n", yylineno, $1, type_to_str(table_data[idx].type), type_to_str($3.type));
                  had_error = 1;
              } else {
                  table_data[idx].value = $3.value;
                  table_data[idx].has_value = 1;
              }
          }
          free($1);
      }
    ;

expr
    : expr '+' term
      { $$ = make_val(merge_type($1.type, $3.type), $1.value + $3.value, $1.ok && $3.ok); }
    | expr '-' term
      { $$ = make_val(merge_type($1.type, $3.type), $1.value - $3.value, $1.ok && $3.ok); }
    | term { $$ = $1; }
    ;

term
    : term '*' factor
      { $$ = make_val(merge_type($1.type, $3.type), $1.value * $3.value, $1.ok && $3.ok); }
    | term '/' factor
      {
          if ($3.ok && $3.value == 0) {
              fprintf(stderr, "PE4 error (line %d): division by zero\n", yylineno);
              had_error = 1;
              $$ = make_val(T_UNKNOWN, 0, 0);
          } else {
              $$ = make_val(merge_type($1.type, $3.type), $1.value / $3.value, $1.ok && $3.ok);
          }
      }
    | factor { $$ = $1; }
    ;

factor
    : '(' expr ')' { $$ = $2; }
    | NUM { $$ = $1; }
    | ID
      {
          int idx = find_symbol($1);
          if (idx < 0) {
              fprintf(stderr, "PE4 error (line %d): variable '%s' not declared\n", yylineno, $1);
              had_error = 1;
              $$ = make_val(T_UNKNOWN, 0, 0);
          } else if (!table_data[idx].has_value) {
              fprintf(stderr, "PE4 error (line %d): variable '%s' used before initialization\n", yylineno, $1);
              had_error = 1;
              $$ = make_val(table_data[idx].type, 0, 0);
          } else {
              $$ = make_val(table_data[idx].type, table_data[idx].value, 1);
          }
          free($1);
      }
    ;

type_spec
    : INT { $$ = T_INT; }
    | FLOAT { $$ = T_FLOAT; }
    | DOUBLE { $$ = T_DOUBLE; }
    | CHAR { $$ = T_CHAR; }
    ;

%%

void yyerror(const char *s)
{
    fprintf(stderr, "PE4 syntax error at line %d near '%s': %s\n", yylineno, yytext ? yytext : "<eof>", s);
    had_error = 1;
}

int main(int argc, char **argv)
{
    if (argc > 1) {
        yyin = fopen(argv[1], "r");
        if (!yyin) {
            perror("fopen");
            return 1;
        }
    }

    yyparse();

    if (yyin && yyin != stdin) fclose(yyin);
    return had_error ? 1 : 0;
}
