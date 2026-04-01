%{
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#include "pe5_parser.tab.h"

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
WS      [ \t\r]+

%%

{WS}                            ;
";"                             { return ';'; }
\n                              { return EOL; }
{ID}                             { yylval.str = xstrdup(yytext); return ID; }
{NUM}                            { yylval.str = xstrdup(yytext); return NUM; }
[()+\-*/]                        { return yytext[0]; }
.                                { return yytext[0]; }

%%
