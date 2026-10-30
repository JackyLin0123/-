#define _POSIX_C_SOURCE 200809L
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
struct Record { long pid; unsigned long long address; int before; int after; };
static void transfer(int fd, void *buf, size_t n, int writing) {
    char *p=buf; while(n) { ssize_t k=writing?write(fd,p,n):read(fd,p,n); if(k<0 && errno==EINTR) continue; if(k<=0) { perror("pipe transfer"); exit(2); } p+=k; n-=(size_t)k; }
}
int main(void) {
    int channel[2]; int value=7; if(pipe(channel)) { perror("pipe"); return 2; }
    if(fflush(NULL)) return 2;
    pid_t child=fork(); if(child<0) { perror("fork"); return 2; }
    if(child==0) { close(channel[0]); struct Record r={(long)getpid(),(unsigned long long)(size_t)&value,value,0}; value=99; r.after=value; transfer(channel[1],&r,sizeof r,1); close(channel[1]); _exit(0); }
    close(channel[1]); struct Record r; transfer(channel[0],&r,sizeof r,0); close(channel[0]); int status;
    if(waitpid(child,&status,0)<0 || !WIFEXITED(status) || WEXITSTATUS(status)!=0) return 3;
    printf("{\"parentPid\":%ld,\"childPid\":%ld,\"sameVirtualAddress\":%s,\"parentBefore\":7,\"parentAfter\":%d,\"childBefore\":%d,\"childAfter\":%d,\"parentAddress\":\"%p\",\"childAddress\":\"0x%llx\"}\n",(long)getpid(),r.pid,r.address==(unsigned long long)(size_t)&value?"true":"false",value,r.before,r.after,(void*)&value,r.address);
    return 0;
}
