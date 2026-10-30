#define _POSIX_C_SOURCE 200809L
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
typedef struct {pthread_mutex_t lock; pthread_cond_t condition; int arrived,generation;} Barrier;
static Barrier barrier={PTHREAD_MUTEX_INITIALIZER,PTHREAD_COND_INITIALIZER,0,0};
static pthread_mutex_t event_lock=PTHREAD_MUTEX_INITIALIZER, count_lock=PTHREAD_MUTEX_INITIALIZER;
static _Atomic int separated=0,rmw=0;
static int protected_count=0,rounds=3;
typedef struct {int thread,round,write,value;} Event;
static Event events[4000]; static int event_count=0;
static void require(int rc) {if(rc){fprintf(stderr,"pthread error %d\n",rc);exit(2);}}
static void rendezvous(void) {
    require(pthread_mutex_lock(&barrier.lock)); int generation=barrier.generation;
    if(++barrier.arrived==2) {barrier.arrived=0;barrier.generation++;require(pthread_cond_broadcast(&barrier.condition));}
    else while(generation==barrier.generation) require(pthread_cond_wait(&barrier.condition,&barrier.lock));
    require(pthread_mutex_unlock(&barrier.lock));
}
static void *worker(void *arg) {
    int thread=*(int*)arg;
    for(int r=0;r<rounds;r++) {
        require(pthread_mutex_lock(&event_lock)); int old=atomic_load(&separated); events[event_count++]=(Event){thread,r,0,old}; require(pthread_mutex_unlock(&event_lock));
        rendezvous();
        require(pthread_mutex_lock(&event_lock)); atomic_store(&separated,old+1);events[event_count++]=(Event){thread,r,1,old+1};require(pthread_mutex_unlock(&event_lock));
        rendezvous();
    }
    for(int i=0;i<rounds;i++) {atomic_fetch_add(&rmw,1);require(pthread_mutex_lock(&count_lock));protected_count++;require(pthread_mutex_unlock(&count_lock));}
    return NULL;
}
int main(int argc,char **argv) {
    if(argc==2) {char *end;errno=0;long n=strtol(argv[1],&end,10);if(errno||*end||n<1||n>1000)return 2; rounds=(int)n;} else if(argc!=1)return 2;
    pthread_t threads[2];int ids[2]={0,1};for(int i=0;i<2;i++)require(pthread_create(&threads[i],NULL,worker,&ids[i]));
    for(int i=0;i<2;i++)require(pthread_join(threads[i],NULL));
    printf("{\"rounds\":%d,\"separateLoadStore\":%d,\"rmw\":%d,\"mutex\":%d,\"events\":[",rounds,atomic_load(&separated),atomic_load(&rmw),protected_count);
    for(int i=0;i<event_count;i++)printf("%s{\"sequence\":%d,\"thread\":%d,\"round\":%d,\"phase\":\"%s\",\"value\":%d}",i?",":"",i,events[i].thread,events[i].round,events[i].write?"store":"load",events[i].value);
    puts("]}");return atomic_load(&separated)==rounds&&atomic_load(&rmw)==2*rounds&&protected_count==2*rounds?0:1;
}
