typedef int myint;

struct Node;
union Data;

enum Color { RED, GREEN = 3, BLUE };

static int global_a = 10, global_b, arr[5];
extern double g2;

int sum(int x, int y) {
    int z = 0;
    z = x + y + global_a;
    return z;
}

void demo() {
    register int i = 1;
    int local[2][3];
    global_b = i + global_a;
}
