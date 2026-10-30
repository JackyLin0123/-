#include <stdio.h>
/* Explicit bounded test domain avoids signed overflow. No ISA-specific assumptions. */
int sum_to(int n) {int total=0;for(int i=0;i<=n;i++)total+=i;return total;}
int branch(int x) {return x<0 ? -x : x+1;}
int call(int x) {return sum_to(x)+branch(x);}
int main(void) {
    const int n[]={0,1,10,100};const int sums[]={0,1,55,5050};
    for(int i=0;i<4;i++)if(sum_to(n[i])!=sums[i]||call(n[i])!=sums[i]+n[i]+1)return 1;
    if(branch(-7)!=7)return 1;
    puts("{\"vectors\":5,\"sum10\":55,\"branchMinus7\":7,\"call10\":66}");return 0;
}
