#ifndef PE3_SYMBOL_TABLE_H
#define PE3_SYMBOL_TABLE_H

#include <stddef.h>

typedef enum {
    SYM_VARIABLE,
    SYM_FUNCTION,
    SYM_PARAMETER,
    SYM_TYPEDEF,
    SYM_ENUM_CONST,
    SYM_STRUCT_TAG,
    SYM_UNION_TAG
} SymbolKind;

typedef struct {
    char name[128];
    SymbolKind kind;
    char type[256];
    char storage[32];
    int size;
    int scope_level;
    int line;
    int col;
    char file[260];
    char init_value[128];
    char use_sites[512];
} Symbol;

void st_init(const char *filename);
void st_free(void);

int st_add_symbol(
    const char *name,
    SymbolKind kind,
    const char *type,
    const char *storage,
    int size,
    int scope_level,
    int line,
    int col,
    const char *init_value
);

void st_add_use(const char *name, int line, int col);
int st_lookup_size(const char *type_desc);
void st_print(void);

const char *st_kind_to_string(SymbolKind kind);

#endif
