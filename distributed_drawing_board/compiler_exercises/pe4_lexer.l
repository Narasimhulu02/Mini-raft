%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "pe4_parser.tab.h"

static char *xstrdup(const char *s)
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
%}

%option noyywrap yylineno nounput noinput

ID      [A-Za-z_][A-Za-z0-9_]*
NUM     [0-9]+(\.[0-9]+)?
WS      [ \t\r\n]+

%%

{WS}                            ;

"int"                           { return INT; }
"float"                         { return FLOAT; }
"double"                        { return DOUBLE; }
"char"                          { return CHAR; }

{ID}                             { yylval.str = xstrdup(yytext); return ID; }
{NUM}                            {
                                     if (strchr(yytext, '.')) {
                                         yylval.expr.type = T_DOUBLE;
                                     } else {
                                         yylval.expr.type = T_INT;
                                     }
                                     yylval.expr.value = atof(yytext);
                                     yylval.expr.ok = 1;
                                     return NUM;
                                 }

[(),;=+\-*/.]                    { return yytext[0]; }

.                                { return yytext[0]; }

%%
