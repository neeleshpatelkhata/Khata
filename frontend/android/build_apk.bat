@echo off
set "JAVA_HOME=C:\Users\HP\jdk17\jdk-17.0.20.1+1"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ANDROID_HOME=C:\Users\HP\.android-sdk"
set "ANDROID_SDK_ROOT=C:\Users\HP\.android-sdk"
echo Using JAVA_HOME=%JAVA_HOME%
echo Using ANDROID_HOME=%ANDROID_HOME%
call "C:\Users\HP\.gradle\wrapper\dists\gradle-8.9-bin\90cnw93cvbtalezasaz0blq0a\gradle-8.9\bin\gradle.bat" assembleDebug --no-daemon
