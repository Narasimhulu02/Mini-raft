%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "pe3_symbol_table.h"

int yylex(void);
void yyerror(const char *s);

extern int yylineno;
extern int yycolno;
extern char *yytext;
extern FILE *yyin;

static int g_scope = 0;
static char g_base_type[64] = "int";
static char g_storage[32] = "auto";
static char g_input_file[260] = "stdin";

static char *dupstr(const char *s)
{
    size_t n = strlen(s) + 1;
    char *p = (char *)malloc(n);
    if (!p) {
        fprintf(stderr, "Out of memory\n");
        exit(1);
    }
    memcpy(p, s, n);
    return p;
}

static char *join2(const char *a, const char *b)
{
    size_t n = strlen(a) + strlen(b) + 1;
    char *p = (char *)malloc(n);
    if (!p) {
        fprintf(stderr, "Out of memory\n");
        exit(1);
    }
    snprintf(p, n, "%s%s", a, b);
    return p;
}

static char *make_decl_type(const char *base, const char *decl)
{
    char buf[320];
    snprintf(buf, sizeof(buf), "%s%s", base, decl);
    return dupstr(buf);
}

static void add_symbol_from_decl(const char *name, SymbolKind kind, const char *decl, const char *init)
{
    char *full_type = make_decl_type(g_base_type, decl ? decl : "");
    int size = st_lookup_size(full_type);
    if (decl && strstr(decl, "*") != NULL) {
        size = 8;
    }
    if (decl && strstr(decl, "[") != NULL) {
        const char *p = decl;
        int count = 1;
        while ((p = strchr(p, '[')) != NULL) {
            int v = atoi(p + 1);
            if (v > 0) count *= v;
            p++;
        }
        size *= count;
    }
    if (!st_add_symbol(name, kind, full_type, g_storage, size, g_scope, yylineno, yycolno, init ? init : "null")) {
        fprintf(stderr, "PE3 warning: redeclaration of '%s' in same scope at line %d.\n", name, yylineno);
    }
    free(full_type);
}
%}

%union {
    char *str;
}

%token <str> ID NUMBER
%token INT FLOAT CHAR DOUBLE VOID
%token TYPEDEF STRUCT UNION ENUM
%token AUTO STATIC EXTERN REGISTER
%token RETURN

%type <str> type_specifier storage_opt pointer_opt array_opt declarator initializer_opt param_decl parameter_list parameter_list_opt

%start program

%%

program
    : items
    ;

items
    : item
    | items item
    ;

item
    : declaration ';'
    | function_definition
    | tag_declaration ';'
    ;

declaration
    : storage_opt type_specifier { strncpy(g_storage, $1, sizeof(g_storage)-1); strncpy(g_base_type, $2, sizeof(g_base_type)-1); free($1); free($2);} declarator_list
    | TYPEDEF type_specifier { strncpy(g_storage, "auto", sizeof(g_storage)-1); strncpy(g_base_type, $2, sizeof(g_base_type)-1); free($2);} typedef_list
    | ENUM ID '{' enum_list '}'
    ;

tag_declaration
    : STRUCT ID
      {
          st_add_symbol($2, SYM_STRUCT_TAG, "struct-tag", "auto", 0, g_scope, yylineno, yycolno, "null");
          free($2);
      }
    | UNION ID
      {
          st_add_symbol($2, SYM_UNION_TAG, "union-tag", "auto", 0, g_scope, yylineno, yycolno, "null");
          free($2);
      }
    ;

declarator_list
    : declarator
    | declarator_list ',' declarator
    ;

declarator
    : pointer_opt ID array_opt initializer_opt
      {
          char *decl = join2($1, $3);
          add_symbol_from_decl($2, SYM_VARIABLE, decl, $4);
          free(decl); free($1); free($2); free($3); free($4);
      }
    ;

typedef_list
    : typedef_name
    | typedef_list ',' typedef_name
    ;

typedef_name
    : pointer_opt ID array_opt
      {
          char *decl = join2($1, $3);
          add_symbol_from_decl($2, SYM_TYPEDEF, decl, "null");
          free(decl); free($1); free($2); free($3);
      }
    ;

initializer_opt
    : '=' NUMBER { $$ = $2; }
    | { $$ = dupstr("null"); }
    ;

function_definition
    : storage_opt type_specifier pointer_opt ID '(' parameter_list_opt ')' compound_block
      {
          char sig[256];
          snprintf(sig, sizeof(sig), "%s%s(%s)", $2, $3, $6 ? $6 : "void");
          st_add_symbol($4, SYM_FUNCTION, sig, $1, 0, 0, yylineno, yycolno, "null");
          free($1); free($2); free($3); free($4); if ($6) free($6);
      }
    ;

parameter_list_opt
    : parameter_list { $$ = $1; }
    | { $$ = dupstr("void"); }
    ;

parameter_list
    : param_decl { $$ = $1; }
    | parameter_list ',' param_decl
      {
          size_t n = strlen($1) + strlen($3) + 2;
          char *p = (char *)malloc(n);
          snprintf(p, n, "%s,%s", $1, $3);
          free($1); free($3);
          $$ = p;
      }
    ;

param_decl
    : type_specifier pointer_opt ID array_opt
      {
          char buf[256];
          char *decl = join2($2, $4);
          snprintf(buf, sizeof(buf), "%s%s", $1, decl);
          st_add_symbol($3, SYM_PARAMETER, buf, "auto", st_lookup_size(buf), g_scope + 1, yylineno, yycolno, "null");
          $$ = dupstr(buf);
          free(decl); free($1); free($2); free($3); free($4);
      }
    ;

compound_block
    : '{' { g_scope++; } block_items '}' { g_scope--; }
    ;

block_items
    :
    | block_items block_item
    ;

block_item
    : declaration ';'
    | statement
    | tag_declaration ';'
    ;

statement
    : compound_block
    | expression_statement
    | RETURN expression_opt ';'
    ;

expression_statement
    : expression_opt ';'
    ;

expression_opt
    :
    | expression
    ;

expression
    : ID
      {
          st_add_use($1, yylineno, yycolno);
          free($1);
      }
    | NUMBER { free($1); }
    | expression '+' expression
    | expression '-' expression
    | expression '*' expression
    | expression '/' expression
    | ID '=' expression
      {
          st_add_use($1, yylineno, yycolno);
          free($1);
      }
    | '(' expression ')'
    ;

enum_list
    : enum_item
    | enum_list ',' enum_item
    ;

enum_item
    : ID
      {
          st_add_symbol($1, SYM_ENUM_CONST, "int", "auto", 4, g_scope, yylineno, yycolno, "null");
          free($1);
      }
    | ID '=' NUMBER
      {
          st_add_symbol($1, SYM_ENUM_CONST, "int", "auto", 4, g_scope, yylineno, yycolno, $3);
          free($1); free($3);
      }
    ;

storage_opt
    : AUTO { $$ = dupstr("auto"); }
    | STATIC { $$ = dupstr("static"); }
    | EXTERN { $$ = dupstr("extern"); }
    | REGISTER { $$ = dupstr("register"); }
    | { $$ = dupstr("auto"); }
    ;

type_specifier
    : INT { $$ = dupstr("int"); }
    | FLOAT { $$ = dupstr("float"); }
    | CHAR { $$ = dupstr("char"); }
    | DOUBLE { $$ = dupstr("double"); }
    | VOID { $$ = dupstr("void"); }
    | STRUCT ID
      {
          char buf[128];
          snprintf(buf, sizeof(buf), "struct %s", $2);
          $$ = dupstr(buf);
          free($2);
      }
    | UNION ID
      {
          char buf[128];
          snprintf(buf, sizeof(buf), "union %s", $2);
          $$ = dupstr(buf);
          free($2);
      }
    ;

pointer_opt
    : '*' pointer_opt
      {
          char *tmp = join2("*", $2);
          free($2);
          $$ = tmp;
      }
    | { $$ = dupstr(""); }
    ;

array_opt
    : '[' NUMBER ']' array_opt
      {
          size_t n = strlen($2) + strlen($4) + 3;
          char *p = (char *)malloc(n);
          snprintf(p, n, "[%s]%s", $2, $4);
          free($2); free($4);
          $$ = p;
      }
    | { $$ = dupstr(""); }
    ;

%%

void yyerror(const char *s)
{
    fprintf(stderr, "PE3 syntax error at line %d, col %d near '%s': %s\n", yylineno, yycolno, yytext ? yytext : "<eof>", s);
}

int main(int argc, char **argv)
{
    if (argc > 1) {
        yyin = fopen(argv[1], "r");
        if (!yyin) {
            perror("fopen");
            return 1;
        }
        strncpy(g_input_file, argv[1], sizeof(g_input_file) - 1);
    }

    st_init(g_input_file);

    if (yyparse() == 0) {
        printf("PE3 parse completed.\n");
        st_print();
    }

    st_free();
    if (yyin && yyin != stdin) fclose(yyin);
    return 0;
}
