CC = gcc
FLEX = flex
BISON = bison
CFLAGS = -Wall -Wextra -std=c11

.PHONY: all pe3 pe4 pe5 clean

all: pe3 pe4 pe5

pe3: pe3_parser.y pe3_lexer.l pe3_symbol_table.c pe3_symbol_table.h
	$(BISON) -d -o pe3_parser.tab.c pe3_parser.y
	$(FLEX) pe3_lexer.l
	$(CC) $(CFLAGS) -o pe3 pe3_parser.tab.c lex.yy.c pe3_symbol_table.c

pe4: pe4_parser.y pe4_lexer.l
	$(BISON) -d -o pe4_parser.tab.c pe4_parser.y
	$(FLEX) pe4_lexer.l
	$(CC) $(CFLAGS) -o pe4 pe4_parser.tab.c lex.yy.c

pe5: pe5_parser.y pe5_lexer.l
	$(BISON) -d -o pe5_parser.tab.c pe5_parser.y
	$(FLEX) pe5_lexer.l
	$(CC) $(CFLAGS) -o pe5 pe5_parser.tab.c lex.yy.c

clean:
	-del /Q lex.yy.c pe3_parser.tab.c pe3_parser.tab.h pe4_parser.tab.c pe4_parser.tab.h pe5_parser.tab.c pe5_parser.tab.h pe3.exe pe4.exe pe5.exe 2>nul || true
	rm -f lex.yy.c pe3_parser.tab.c pe3_parser.tab.h pe4_parser.tab.c pe4_parser.tab.h pe5_parser.tab.c pe5_parser.tab.h pe3 pe4 pe5 pe3.exe pe4.exe pe5.exe
