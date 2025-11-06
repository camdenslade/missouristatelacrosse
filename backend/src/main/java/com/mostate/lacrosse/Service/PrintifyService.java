package com.mostate.lacrosse.Service;

import com.mostate.lacrosse.Controller.Printify.PrintifyOrderRequest;
import com.mostate.lacrosse.Controller.Printify.ShippingInfo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PrintifyService {

    @Value("${printify.api.baseUrl}")
    private String baseUrl;

    @Value("${printify.apiToken}")
    private String apiToken;

    @Value("${printify.shopId}")
    private String shopId;

    private final RestTemplate rest = new RestTemplate();

    public List<Map<String, Object>> getProducts() {
        try {
            String url = baseUrl + "/shops/" + shopId + "/products.json";

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Void> request = new HttpEntity<>(headers);
            ResponseEntity<Map> response = rest.exchange(url, HttpMethod.GET, request, Map.class);

            List<Map<String, Object>> data = (List<Map<String, Object>>) response.getBody().get("data");
            if (data == null) return List.of();

            return data.stream().map(p -> {
                Map<String, Object> firstVariant = ((List<Map<String, Object>>) p.get("variants")).get(0);
                Map<String, Object> product = new HashMap<>();
                product.put("id", p.get("id"));
                product.put("title", p.get("title"));

                List<Map<String, Object>> images = (List<Map<String, Object>>) p.get("images");
                product.put("image", (images != null && !images.isEmpty()) ? images.get(0).get("src") : null);

                double basePrice = ((Number) firstVariant.get("price")).doubleValue() / 100.0;
                double adjusted = Math.round(((basePrice + 5) / 5)) * 5;
                product.put("price", String.format("%.2f", adjusted));
                product.put("variantId", firstVariant.get("id"));
                return product;
            }).collect(Collectors.toList());

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to fetch Printify products: " + e.getMessage());
        }
    }

    public Map<String, Object> createOrder(PrintifyOrderRequest req) {
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

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = rest.exchange(url, HttpMethod.POST, request, Map.class);

            return response.getBody();

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to create Printify order: " + e.getMessage());
        }
    }
}
