#define _POSIX_C_SOURCE 200809L
#include <fcntl.h>
#include <unistd.h>
#include <string.h>
#include <stdio.h>
#include <errno.h>
int main(int argc,char **argv) {
    if(argc!=2) return 2;
    const char expected[]="pi02-private-file\n"; char actual[sizeof expected]={0};
    int fd=open(argv[1],O_WRONLY|O_CREAT|O_EXCL,0600); if(fd<0) {perror("open");return 2;}
    size_t pos=0; while(pos<sizeof expected-1) {ssize_t n=write(fd,expected+pos,sizeof expected-1-pos); if(n<0&&errno==EINTR)continue;if(n<=0)return 3;pos+=(size_t)n;}
    if(fsync(fd)||close(fd))return 3;
    fd=open(argv[1],O_RDONLY); if(fd<0)return 3; pos=0;
    while(pos<sizeof expected-1) {ssize_t n=read(fd,actual+pos,sizeof expected-1-pos);if(n<0&&errno==EINTR)continue;if(n<=0)return 4;pos+=(size_t)n;}
    if(close(fd)||memcmp(expected,actual,sizeof expected-1))return 4;
    puts("{\"fileEqual\":true}"); return 0;
}
