%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int yylex(void);
void yyerror(const char *s);

extern int yylineno;
extern char *yytext;
extern FILE *yyin;

typedef struct ASTNode {
    char token[64];
    struct ASTNode *left;
    struct ASTNode *right;
} ASTNode;

static ASTNode *mk_node(const char *tok, ASTNode *l, ASTNode *r)
{
    ASTNode *n = (ASTNode *)malloc(sizeof(ASTNode));
    if (!n) {
        fprintf(stderr, "Out of memory\n");
        exit(1);
    }
    strncpy(n->token, tok, sizeof(n->token) - 1);
    n->token[sizeof(n->token) - 1] = '\0';
    n->left = l;
    n->right = r;
    return n;
}

static void print_postorder(ASTNode *n)
{
    if (!n) return;
    print_postorder(n->left);
    print_postorder(n->right);
    printf("%s ", n->token);
}

static void free_ast(ASTNode *n)
{
    if (!n) return;
    free_ast(n->left);
    free_ast(n->right);
    free(n);
}
%}

%union {
    char *str;
    ASTNode *node;
}

%token <str> ID NUM
%token EOL

%type <node> expr term factor line

%left '+' '-'
%left '*' '/'
%right UMINUS

%start input

%%

input
    :
    | input line
    ;

line
    : expr EOL
      {
          print_postorder($1);
          printf("\n");
          free_ast($1);
      }
    | ';' EOL
    | EOL
    ;

expr
    : expr '+' term { $$ = mk_node("+", $1, $3); }
    | expr '-' term { $$ = mk_node("-", $1, $3); }
    | term { $$ = $1; }
    ;

term
    : term '*' factor { $$ = mk_node("*", $1, $3); }
    | term '/' factor { $$ = mk_node("/", $1, $3); }
    | factor { $$ = $1; }
    ;

factor
    : '(' expr ')' { $$ = $2; }
    | '-' factor %prec UMINUS { $$ = mk_node("neg", $2, NULL); }
    | ID { $$ = mk_node($1, NULL, NULL); free($1); }
    | NUM { $$ = mk_node($1, NULL, NULL); free($1); }
    ;

%%

void yyerror(const char *s)
{
    fprintf(stderr, "PE5 syntax error at line %d near '%s': %s\n", yylineno, yytext ? yytext : "<eof>", s);
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
    return 0;
}
