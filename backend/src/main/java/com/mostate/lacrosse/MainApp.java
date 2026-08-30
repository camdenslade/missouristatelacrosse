package com.mostate.lacrosse;

import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

@SpringBootApplication
@EnableScheduling
public class MainApp {

    public static void main(String[] args) {
        loadSecretsFromAWS();
        SpringApplication.run(MainApp.class, args);
    }

    /**
     * True for local development, where there is no AWS account to reach. Detected from
     * the active Spring profile ("local"/"dev") or an explicit AWS_SECRETS_DISABLED=true.
     * In that mode config comes from application-local.properties / env vars instead of
     * Secrets Manager.
     */
    private static boolean awsSecretsDisabled() {
        if ("true".equalsIgnoreCase(System.getenv("AWS_SECRETS_DISABLED"))) {
            return true;
        }
        String profiles = System.getProperty("spring.profiles.active",
                System.getenv().getOrDefault("SPRING_PROFILES_ACTIVE", ""));
        for (String p : profiles.split(",")) {
            String t = p.trim().toLowerCase();
            if (t.equals("local") || t.equals("dev") || t.equals("test")) {
                return true;
            }
        }
        return false;
    }

    private static void loadSecretsFromAWS() {
        if (awsSecretsDisabled()) {
            System.out.println("Skipping AWS Secrets Manager (local/dev profile). "
                + "Using application-local.properties / environment variables.");
            return;
        }
        try (SecretsManagerClient client = SecretsManagerClient.builder()
                .region(Region.US_EAST_1)
                .build()) {

            GetSecretValueRequest request = GetSecretValueRequest.builder()
                    .secretId("backend-prod")
                    .build();

            GetSecretValueResponse response = client.getSecretValue(request);
            String secretJson = response.secretString();

            if (secretJson == null || secretJson.isEmpty()) {
                throw new RuntimeException("Backend secret was empty!");
            }

            ObjectMapper mapper = new ObjectMapper();
            Map<String, String> secretsMap = mapper.readValue(
                secretJson,
                new TypeReference<Map<String, String>>() {}
            );

            // AWS and App credentials
            setPropertyIfPresent(secretsMap, "PAYPAL_CLIENT_ID");
            setPropertyIfPresent(secretsMap, "PAYPAL_CLIENT_SECRET");
            setPropertyIfPresent(secretsMap, "STRIPE_SECRET_KEY");
            setPropertyIfPresent(secretsMap, "STRIPE_PUBLISHABLE_KEY");
            setPropertyIfPresent(secretsMap, "STRIPE_WEBHOOK_SECRET");
            setPropertyIfPresent(secretsMap, "PRINTIFY_API_TOKEN");
            setPropertyIfPresent(secretsMap, "PRINTIFY_SHOP_ID");
            setPropertyIfPresent(secretsMap, "AWS_SES_SENDER");
            setPropertyIfPresent(secretsMap, "AWS_REGION");

            // Base URLs and storage
            setPropertyIfPresent(secretsMap, "PAYPAL_BASE_URL");
            setPropertyIfPresent(secretsMap, "PRINTIFY_BASE_URL");
            setPropertyIfPresent(secretsMap, "DB_URL");
            setPropertyIfPresent(secretsMap, "DB_USER");
            setPropertyIfPresent(secretsMap, "DB_PASSWORD");
            setPropertyIfPresent(secretsMap, "S3_BUCKET");
            setPropertyIfPresent(secretsMap, "S3_PUBLIC_BASE_URL");

            System.out.println("Secrets and base URLs loaded successfully from AWS Secrets Manager.");

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to load secrets from AWS Secrets Manager", e);
        }
    }

    private static void setPropertyIfPresent(Map<String, String> secretsMap, String key) {
        String value = secretsMap.get(key);
        if (value != null) {
            System.setProperty(key, value);
        }
    }
}
