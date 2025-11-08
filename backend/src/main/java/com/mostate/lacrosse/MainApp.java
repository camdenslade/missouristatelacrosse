package com.mostate.lacrosse;

import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

@SpringBootApplication
public class MainApp {

    public static void main(String[] args) {
        loadSecretsFromAWS();
        SpringApplication.run(MainApp.class, args);
    }

    private static void loadSecretsFromAWS() {
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
            Map<String, String> secretsMap = mapper.readValue(secretJson, Map.class);

            // AWS and App credentials
            System.setProperty("PAYPAL_CLIENT_ID", secretsMap.get("PAYPAL_CLIENT_ID"));
            System.setProperty("PAYPAL_CLIENT_SECRET", secretsMap.get("PAYPAL_CLIENT_SECRET"));
            System.setProperty("PRINTIFY_API_TOKEN", secretsMap.get("PRINTIFY_API_TOKEN"));
            System.setProperty("PRINTIFY_SHOP_ID", secretsMap.get("PRINTIFY_SHOP_ID"));
            System.setProperty("AWS_SES_SENDER", secretsMap.get("AWS_SES_SENDER"));
            System.setProperty("AWS_REGION", secretsMap.get("AWS_REGION"));

            // Base URLs
            System.setProperty("PAYPAL_BASE_URL", secretsMap.get("PAYPAL_BASE_URL"));
            System.setProperty("PRINTIFY_BASE_URL", secretsMap.get("PRINTIFY_BASE_URL"));

            System.out.println("Secrets and base URLs loaded successfully from AWS Secrets Manager.");

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to load secrets from AWS Secrets Manager", e);
        }
    }
}
