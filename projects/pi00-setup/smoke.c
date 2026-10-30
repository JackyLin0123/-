#include <stdio.h>
int main(void) { int a[] = {2, 3, 5}; int *p = a; printf("{\"sum\":%d,\"pointer_first\":%d}\n", a[0]+a[1]+a[2], *p); return 0; }
