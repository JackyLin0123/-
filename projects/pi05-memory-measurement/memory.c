#define _POSIX_C_SOURCE 200809L
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <errno.h>
#ifdef _WIN32
#include <windows.h>
static double now_ns(void){LARGE_INTEGER c,f;QueryPerformanceCounter(&c);QueryPerformanceFrequency(&f);return (double)c.QuadPart*1e9/(double)f.QuadPart;}
#else
static double now_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t))exit(3);return (double)t.tv_sec*1e9+t.tv_nsec;}
#endif
static uint32_t state=17;
static uint32_t random32(void){state^=state<<13;state^=state>>17;state^=state<<5;return state;}
static volatile uint64_t visible_checksum;
static uint64_t scan(const uint32_t *next,size_t n,size_t count,int chase){size_t p=0;uint64_t sum=0;for(size_t i=0;i<count;i++){if(chase)p=next[p];else p=i%n;sum+=chase?p:next[p];}return sum;}
int main(int argc,char **argv){
    if(argc!=5)return 2;
    char *end;errno=0;unsigned long bytes=strtoul(argv[1],&end,10);if(errno||*end||bytes<4096||bytes>134217728||bytes%sizeof(uint32_t))return 2;
    unsigned long accesses=strtoul(argv[2],&end,10);if(errno||*end||accesses<1024||accesses>16777216)return 2;
    int chase=atoi(argv[3]);if(chase!=0&&chase!=1)return 2;state=(uint32_t)strtoul(argv[4],&end,10);if(*end||state==0)return 2;
    size_t n=bytes/sizeof(uint32_t);uint32_t *next=malloc(bytes);if(!next){perror("malloc");return 3;}
    for(size_t i=0;i<n;i++)next[i]=(uint32_t)i;
    /* Sattolo permutation: one cycle, no auxiliary full-size buffer. */
    for(size_t i=n-1;i>0;i--){size_t j=random32()%i;uint32_t t=next[i];next[i]=next[j];next[j]=t;}
    uint64_t expected=scan(next,n,accesses,chase);visible_checksum=scan(next,n,accesses,chase); /* warm-up, not timed */
    double begin=now_ns();uint64_t checksum=scan(next,n,accesses,chase);double elapsed=now_ns()-begin;visible_checksum=checksum;
    printf("{\"bytes\":%lu,\"accesses\":%lu,\"mode\":\"%s\",\"elapsedNs\":%.0f,\"nsPerAccess\":%.9f,\"checksum\":%llu,\"expectedChecksum\":%llu}\n",bytes,accesses,chase?"dependent-random":"sequential",elapsed,elapsed/accesses,(unsigned long long)visible_checksum,(unsigned long long)expected);
    free(next);return checksum==expected&&elapsed>0?0:1;
}
