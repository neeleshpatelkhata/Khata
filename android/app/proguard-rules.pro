# Keep readable crash reports in Play Console.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor bridges JavaScript to native code by reflection, so anything the
# WebView can reach must survive shrinking and obfuscation.
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}

# Cordova plugins wrapped by Capacitor are instantiated by name.
-keep class org.apache.cordova.** { *; }

# Plugin classes are resolved from capacitor.plugins.json at runtime.
-keep class com.capacitorjs.plugins.** { *; }

# The app's own entry point.
-keep class com.khata.ledger.enterprise.** { *; }

# Silence warnings for optional dependencies that are not on the classpath.
-dontwarn org.apache.cordova.**
-dontwarn com.google.android.**
