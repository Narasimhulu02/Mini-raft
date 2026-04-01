%{
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#include "pe3_parser.tab.h"

int yycolno = 1;

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

#define YY_USER_ACTION yycolno += yyleng;
%}

%option noyywrap yylineno nounput noinput

ID      [A-Za-z_][A-Za-z0-9_]*
NUM     [0-9]+
WS      [ \t\r]+

%%

"//"[^\n]*                      ;
"/*"([^*]|\*+[^*/])*\*+"/"     ;

\n                              { yycolno = 1; }
{WS}                            ;

"int"                           { return INT; }
"float"                         { return FLOAT; }
"char"                          { return CHAR; }
"double"                        { return DOUBLE; }
"void"                          { return VOID; }
"typedef"                       { return TYPEDEF; }
"struct"                        { return STRUCT; }
"union"                         { return UNION; }
"enum"                          { return ENUM; }
"auto"                          { return AUTO; }
"static"                        { return STATIC; }
"extern"                        { return EXTERN; }
"register"                      { return REGISTER; }
"return"                        { return RETURN; }

{ID}                             { yylval.str = xstrdup(yytext); return ID; }
{NUM}                            { yylval.str = xstrdup(yytext); return NUMBER; }

"=="|"!="|"<="|">="|"&&"|"||"|"++"|"--"|"+="|"-="|"*="|"/="  { return yytext[0]; }

[{}()\[\],;=:+\-*/]             { return yytext[0]; }

.                                { return yytext[0]; }

%%
