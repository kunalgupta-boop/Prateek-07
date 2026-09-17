FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/target/secureauth.jar app.jar

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java","-XX:+UseSerialGC","-XX:MaxRAMPercentage=75.0","-jar","app.jar"]
