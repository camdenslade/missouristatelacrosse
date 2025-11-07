FROM gradle:8.4-jdk17-alpine AS build
WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon

FROM amazoncorretto:17-alpine3.19
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring
RUN apk add --no-cache curl
COPY --from=build /app/build/libs/*.jar app.jar
RUN chown spring:spring app.jar
USER spring:spring
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
