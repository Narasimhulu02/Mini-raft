#include "pe3_symbol_table.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    Symbol *items;
    size_t count;
    size_t cap;
    char input_file[260];
} SymbolTable;

static SymbolTable g_table;

static void ensure_capacity(void)
{
    if (g_table.count < g_table.cap) {
        return;
    }
    g_table.cap = (g_table.cap == 0) ? 64 : (g_table.cap * 2);
    g_table.items = (Symbol *)realloc(g_table.items, g_table.cap * sizeof(Symbol));
    if (!g_table.items) {
        fprintf(stderr, "Out of memory while growing symbol table.\n");
        exit(1);
    }
}

const char *st_kind_to_string(SymbolKind kind)
{
    switch (kind) {
        case SYM_VARIABLE: return "variable";
        case SYM_FUNCTION: return "function";
        case SYM_PARAMETER: return "parameter";
        case SYM_TYPEDEF: return "typedef";
        case SYM_ENUM_CONST: return "enum-const";
        case SYM_STRUCT_TAG: return "struct-tag";
        case SYM_UNION_TAG: return "union-tag";
        default: return "unknown";
    }
}

void st_init(const char *filename)
{
    memset(&g_table, 0, sizeof(g_table));
    if (filename) {
        strncpy(g_table.input_file, filename, sizeof(g_table.input_file) - 1);
    }
}

void st_free(void)
{
    free(g_table.items);
    g_table.items = NULL;
    g_table.count = 0;
    g_table.cap = 0;
}

static int is_same_scope_name(const Symbol *s, const char *name, int scope_level)
{
    return strcmp(s->name, name) == 0 && s->scope_level == scope_level;
}

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
)
{
    size_t i;
    Symbol *sym;

    for (i = 0; i < g_table.count; ++i) {
        if (is_same_scope_name(&g_table.items[i], name, scope_level)) {
            return 0;
        }
    }

    ensure_capacity();
    sym = &g_table.items[g_table.count++];
    memset(sym, 0, sizeof(*sym));

    strncpy(sym->name, name ? name : "", sizeof(sym->name) - 1);
    sym->kind = kind;
    strncpy(sym->type, type ? type : "", sizeof(sym->type) - 1);
    strncpy(sym->storage, storage ? storage : "auto", sizeof(sym->storage) - 1);
    sym->size = size;
    sym->scope_level = scope_level;
    sym->line = line;
    sym->col = col;
    strncpy(sym->file, g_table.input_file[0] ? g_table.input_file : "stdin", sizeof(sym->file) - 1);
    strncpy(sym->init_value, init_value ? init_value : "null", sizeof(sym->init_value) - 1);
    strncpy(sym->use_sites, "-", sizeof(sym->use_sites) - 1);

    return 1;
}

void st_add_use(const char *name, int line, int col)
{
    int i;
    int best = -1;
    int best_scope = -1;
    char entry[32];

    for (i = 0; i < (int)g_table.count; ++i) {
        if (strcmp(g_table.items[i].name, name) == 0 && g_table.items[i].scope_level >= best_scope) {
            best_scope = g_table.items[i].scope_level;
            best = i;
        }
    }

    if (best < 0) {
        return;
    }

    snprintf(entry, sizeof(entry), "%d:%d", line, col);

    if (strcmp(g_table.items[best].use_sites, "-") == 0) {
        strncpy(g_table.items[best].use_sites, entry, sizeof(g_table.items[best].use_sites) - 1);
    } else {
        size_t used = strlen(g_table.items[best].use_sites);
        size_t left = sizeof(g_table.items[best].use_sites) - used - 1;
        if (left > 0) {
            strncat(g_table.items[best].use_sites, ",", left);
            left = sizeof(g_table.items[best].use_sites) - strlen(g_table.items[best].use_sites) - 1;
            strncat(g_table.items[best].use_sites, entry, left);
        }
    }
}

int st_lookup_size(const char *type_desc)
{
    if (!type_desc || !type_desc[0]) {
        return 0;
    }

    if (strstr(type_desc, "char") != NULL) return 1;
    if (strstr(type_desc, "int") != NULL) return 4;
    if (strstr(type_desc, "float") != NULL) return 4;
    if (strstr(type_desc, "double") != NULL) return 8;
    if (strstr(type_desc, "void") != NULL) return 0;

    return 4;
}

void st_print(void)
{
    size_t i;

    printf("\n%-16s %-12s %-28s %-10s %-6s %-6s %-14s %-12s %-20s\n",
           "Name", "Kind", "Type", "Storage", "Size", "Scope", "Definition", "Init", "UseSites");
    printf("%-16s %-12s %-28s %-10s %-6s %-6s %-14s %-12s %-20s\n",
           "----------------", "------------", "----------------------------", "----------", "------", "------", "--------------", "------------", "--------------------");

    for (i = 0; i < g_table.count; ++i) {
        char def_loc[64];
        snprintf(def_loc, sizeof(def_loc), "%s:%d:%d", g_table.items[i].file, g_table.items[i].line, g_table.items[i].col);

        printf("%-16s %-12s %-28s %-10s %-6d %-6d %-14s %-12s %-20s\n",
               g_table.items[i].name,
               st_kind_to_string(g_table.items[i].kind),
               g_table.items[i].type,
               g_table.items[i].storage,
               g_table.items[i].size,
               g_table.items[i].scope_level,
               def_loc,
               g_table.items[i].init_value,
               g_table.items[i].use_sites);
    }
}
