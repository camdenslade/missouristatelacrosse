package com.mostate.lacrosse.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mostate.lacrosse.Controller.Printify.PrintifyOrderRequest;
import com.mostate.lacrosse.Controller.Printify.ShippingInfo;
import com.mostate.lacrosse.Model.PrintifyOrderLog;
import com.mostate.lacrosse.Repository.PrintifyOrderLogRepository;

@Service
public class PrintifyService {

    @Value("${PRINTIFY_BASE_URL}")
    private String baseUrl;

    @Value("${PRINTIFY_API_TOKEN}")
    private String apiToken;

    @Value("${PRINTIFY_SHOP_ID}")
    private String shopId;

    private final RestTemplate rest = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final PrintifyOrderLogRepository orderLogRepo;
    private static final ParameterizedTypeReference<Map<String, Object>> MAP_RESPONSE =
        new ParameterizedTypeReference<>() {};

    public PrintifyService(PrintifyOrderLogRepository orderLogRepo) {
        this.orderLogRepo = orderLogRepo;
    }

    /**
     * Creates standardized HTTP headers for all Printify API requests.
     * Includes required User-Agent header per Printify API requirements.
     * 
     * @return HttpHeaders with Authorization, Content-Type, and User-Agent set
     */
    private HttpHeaders createPrintifyHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("User-Agent", "MissouriStateLacrosse/1.0");
        return headers;
    }

    public List<Map<String, Object>> getProducts() {
        try {
            String url = baseUrl + "/shops/" + shopId + "/products.json";

            HttpHeaders headers = createPrintifyHeaders();
            HttpEntity<Void> request = new HttpEntity<>(headers);
            ResponseEntity<Map<String, Object>> response = rest.exchange(
                url,
                HttpMethod.GET,
                request,
                MAP_RESPONSE
            );

            Object dataRaw = response.getBody() != null ? response.getBody().get("data") : null;
            if (!(dataRaw instanceof List<?> dataList)) return List.of();

            List<Map<String, Object>> products = new java.util.ArrayList<>();

            for (Object obj : dataList) {
                Map<String, Object> product = castMap(obj);

                List<Map<String, Object>> variants = castMapList(product.get("variants"));
                for (Map<String, Object> variant : variants) {

                    Object priceObj = variant.get("price");
                    if (priceObj == null) {
                        continue;
                    }
                    double basePrice = (priceObj instanceof Number n) ? n.doubleValue() / 100.0 :
                        Double.parseDouble(priceObj.toString()) / 100.0;

                    double adjusted = Math.round(((basePrice + 5) / 5)) * 5;

                    variant.put("our_price", (int) (adjusted * 100));
                }

                products.add(product);
            }

            return products;

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to fetch Printify products: " + e.getMessage());
        }
    }


    public Map<String, Object> createOrder(PrintifyOrderRequest req) {
        PrintifyOrderLog log = new PrintifyOrderLog(req.getOrderId(), shopId);
        String requestPayloadJson = null;
        Integer httpStatusCode = null;
        String responsePayloadJson = null;
        String errorMessage = null;

        try {
            String url = baseUrl + "/shops/" + shopId + "/orders.json";

            Map<String, Object> body = new HashMap<>();
            body.put("external_id", req.getOrderId());
            body.put("label", "TeamStore Checkout");

            List<Map<String, Object>> lineItems = req.getItems().stream().map(item -> {
                Map<String, Object> i = new HashMap<>();
                i.put("product_id", item.getProductId());
                i.put("variant_id", item.getVariantId());
                i.put("quantity", item.getQuantity());
                return i;
            }).collect(Collectors.toList());

            body.put("line_items", lineItems);
            body.put("shipping_method", 1);
            body.put("send_shipping_notification", true);

            ShippingInfo s = req.getShipping();
            Map<String, Object> addr = new HashMap<>();
            addr.put("first_name", s.getFirstName());
            addr.put("last_name", s.getLastName());
            addr.put("email", s.getEmail());
            addr.put("phone", s.getPhone());
            addr.put("country", s.getCountry());
            addr.put("region", s.getRegion());
            addr.put("address1", s.getAddress1());
            addr.put("address2", s.getAddress2());
            addr.put("city", s.getCity());
            addr.put("zip", s.getZip());
            body.put("address_to", addr);

            // Serialize request payload for logging (excluding sensitive data)
            try {
                requestPayloadJson = objectMapper.writeValueAsString(body);
            } catch (Exception e) {
                requestPayloadJson = "Failed to serialize request: " + e.getMessage();
            }

            HttpHeaders headers = createPrintifyHeaders();
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            try {
                ResponseEntity<Map<String, Object>> response = rest.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    MAP_RESPONSE
                );
                httpStatusCode = response.getStatusCode().value();
                
                // Serialize response payload
                try {
                    responsePayloadJson = objectMapper.writeValueAsString(response.getBody());
                } catch (Exception e) {
                    responsePayloadJson = "Failed to serialize response: " + e.getMessage();
                }

                // Check if response indicates success (2xx status codes)
                if (httpStatusCode >= 200 && httpStatusCode < 300) {
                    log.setSuccess(true);
                    log.setHttpStatusCode(httpStatusCode);
                    log.setRequestPayload(requestPayloadJson);
                    log.setResponsePayload(responsePayloadJson);
                    
                    // Log success before returning
                    safeSaveLog(log);
                    
                    return response.getBody();
                } else {
                    // Non-2xx but no exception thrown
                    errorMessage = "Unexpected status code: " + httpStatusCode;
                    log.setSuccess(false);
                    log.setHttpStatusCode(httpStatusCode);
                    log.setRequestPayload(requestPayloadJson);
                    log.setResponsePayload(responsePayloadJson);
                    log.setErrorMessage(errorMessage);
                    safeSaveLog(log);
                    
                    throw new RuntimeException("Printify API returned status " + httpStatusCode);
                }

            } catch (HttpClientErrorException e) {
                // 4xx errors (client errors, validation errors, rate limits)
                httpStatusCode = e.getStatusCode().value();
                responsePayloadJson = e.getResponseBodyAsString();
                errorMessage = e.getMessage();
                
                log.setSuccess(false);
                log.setHttpStatusCode(httpStatusCode);
                log.setRequestPayload(requestPayloadJson);
                log.setResponsePayload(responsePayloadJson != null ? responsePayloadJson : "No response body");
                log.setErrorMessage(errorMessage);
                safeSaveLog(log);

                // Distinguish rate limit errors
                if (httpStatusCode == 429) {
                    throw new RuntimeException("Printify rate limit exceeded (429). Please retry later.", e);
                } else {
                    throw new RuntimeException("Printify API client error (" + httpStatusCode + "): " + 
                        (responsePayloadJson != null ? responsePayloadJson : errorMessage), e);
                }

            } catch (HttpServerErrorException e) {
                // 5xx errors (server errors)
                httpStatusCode = e.getStatusCode().value();
                responsePayloadJson = e.getResponseBodyAsString();
                errorMessage = e.getMessage();
                
                log.setSuccess(false);
                log.setHttpStatusCode(httpStatusCode);
                log.setRequestPayload(requestPayloadJson);
                log.setResponsePayload(responsePayloadJson != null ? responsePayloadJson : "No response body");
                log.setErrorMessage(errorMessage);
                safeSaveLog(log);

                throw new RuntimeException("Printify API server error (" + httpStatusCode + "): " + 
                    (responsePayloadJson != null ? responsePayloadJson : errorMessage), e);

            } catch (RestClientException e) {
                // Network errors, timeouts, etc.
                errorMessage = e.getMessage();
                
                log.setSuccess(false);
                log.setHttpStatusCode(null); // No HTTP status for network errors
                log.setRequestPayload(requestPayloadJson);
                log.setResponsePayload("Network/connection error");
                log.setErrorMessage(errorMessage);
                safeSaveLog(log);

                throw new RuntimeException("Failed to connect to Printify API: " + errorMessage, e);
            }

        } catch (RuntimeException e) {
            // Re-throw runtime exceptions (already logged above)
            throw e;
        } catch (Exception e) {
            // Catch-all for any other unexpected errors
            errorMessage = e.getMessage();
            
            log.setSuccess(false);
            log.setHttpStatusCode(httpStatusCode);
            log.setRequestPayload(requestPayloadJson);
            log.setResponsePayload(responsePayloadJson != null ? responsePayloadJson : "Exception occurred before response");
            log.setErrorMessage(errorMessage);
            safeSaveLog(log);

            e.printStackTrace();
            throw new RuntimeException("Failed to create Printify order: " + errorMessage, e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Object value) {
        if (value instanceof Map<?, ?>) {
            return (Map<String, Object>) value;
        }
        return new HashMap<>();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castMapList(Object value) {
        if (value instanceof List<?>) {
            return (List<Map<String, Object>>) value;
        }
        return List.of();
    }

    private void safeSaveLog(PrintifyOrderLog log) {
        try {
            orderLogRepo.save(log);
        } catch (Exception e) {
            System.err.println("Failed to save Printify order log: " + e.getMessage());
        }
    }
}
