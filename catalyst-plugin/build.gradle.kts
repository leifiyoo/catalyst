plugins {
    java
}

group = "dev.catalyst"
version = "1.0.0"

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

repositories {
    mavenCentral()
    maven("https://hub.spigotmc.org/nexus/content/repositories/snapshots/")
    maven("https://oss.sonatype.org/content/repositories/snapshots/")
}

dependencies {
    compileOnly("org.spigotmc:spigot-api:1.20.4-R0.1-SNAPSHOT")
    implementation("com.google.code.gson:gson:2.10.1")
    // com.sun.net.httpserver is included in the JDK
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
}

tasks.jar {
    archiveFileName.set("CatalystAnalytics-${version}.jar")
}

tasks.processResources {
    filesMatching("plugin.yml") {
        expand("version" to version)
    }
}
