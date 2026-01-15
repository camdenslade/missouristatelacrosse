package com.mostate.lacrosse.Service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mostate.lacrosse.Controller.Printify.PrintifyOrderRequest;
import com.mostate.lacrosse.Controller.Printify.ShippingInfo;
import com.mostate.lacrosse.Model.PrintifyOrderLog;
import com.mostate.lacrosse.Repository.PrintifyOrderLogRepository;

@ExtendWith(MockitoExtension.class)
class PrintifyServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private PrintifyOrderLogRepository orderLogRepo;

    @InjectMocks
    private PrintifyService printifyService;

    private final String baseUrl = "https://api.printify.com/v1";
    private final String apiToken = "test-token";
    private final String shopId = "test-shop-id";

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(printifyService, "baseUrl", baseUrl);
        ReflectionTestUtils.setField(printifyService, "apiToken", apiToken);
        ReflectionTestUtils.setField(printifyService, "shopId", shopId);
        ReflectionTestUtils.setField(printifyService, "rest", restTemplate);
    }

    @Test
    void testCreateOrder_Success_LogsOrder() {
        // Arrange
        PrintifyOrderRequest request = createTestOrderRequest();
        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("id", "order-123");
        responseBody.put("status", "pending");

        ResponseEntity<Map<String, Object>> response = new ResponseEntity<>(responseBody, HttpStatus.OK);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
            .thenReturn(response);
        when(orderLogRepo.save(any(PrintifyOrderLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        Map<String, Object> result = printifyService.createOrder(request);

        // Assert
        assertNotNull(result);
        assertEquals("order-123", result.get("id"));

        // Verify headers include User-Agent and Authorization
        ArgumentCaptor<HttpEntity<?>> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(anyString(), eq(HttpMethod.POST), entityCaptor.capture(), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any());
        
        HttpEntity<?> capturedEntity = entityCaptor.getValue();
        HttpHeaders headers = capturedEntity.getHeaders();
        
        assertEquals("MissouriStateLacrosse/1.0", headers.getFirst("User-Agent"));
        assertTrue(headers.getFirst("Authorization").startsWith("Bearer"));
        assertEquals(MediaType.APPLICATION_JSON, headers.getContentType());

        // Verify logging was attempted
        ArgumentCaptor<PrintifyOrderLog> logCaptor = ArgumentCaptor.forClass(PrintifyOrderLog.class);
        verify(orderLogRepo).save(logCaptor.capture());
        
        PrintifyOrderLog savedLog = logCaptor.getValue();
        assertTrue(savedLog.isSuccess());
        assertEquals(200, savedLog.getHttpStatusCode());
        assertNotNull(savedLog.getRequestPayload());
        assertNotNull(savedLog.getResponsePayload());
    }

    @Test
    void testCreateOrder_4xxError_LogsError() {
        // Arrange
        PrintifyOrderRequest request = createTestOrderRequest();
        HttpClientErrorException exception = new HttpClientErrorException(
            HttpStatus.BAD_REQUEST, "Invalid request", "{\"error\":\"validation failed\"}".getBytes(), null);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
            .thenThrow(exception);
        when(orderLogRepo.save(any(PrintifyOrderLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act & Assert
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> {
            printifyService.createOrder(request);
        });

        assertTrue(thrown.getMessage().contains("Printify API client error"));
        assertTrue(thrown.getMessage().contains("400"));

        // Verify error was logged
        ArgumentCaptor<PrintifyOrderLog> logCaptor = ArgumentCaptor.forClass(PrintifyOrderLog.class);
        verify(orderLogRepo).save(logCaptor.capture());
        
        PrintifyOrderLog savedLog = logCaptor.getValue();
        assertFalse(savedLog.isSuccess());
        assertEquals(400, savedLog.getHttpStatusCode());
        assertNotNull(savedLog.getErrorMessage());
    }

    @Test
    void testCreateOrder_429RateLimit_LogsAndThrowsSpecificError() {
        // Arrange
        PrintifyOrderRequest request = createTestOrderRequest();
        HttpClientErrorException exception = new HttpClientErrorException(
            HttpStatus.TOO_MANY_REQUESTS, "Rate limit exceeded", "{\"error\":\"rate limit\"}".getBytes(), null);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
            .thenThrow(exception);
        when(orderLogRepo.save(any(PrintifyOrderLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act & Assert
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> {
            printifyService.createOrder(request);
        });

        assertTrue(thrown.getMessage().contains("rate limit exceeded"));
        assertTrue(thrown.getMessage().contains("429"));

        // Verify rate limit was logged
        ArgumentCaptor<PrintifyOrderLog> logCaptor = ArgumentCaptor.forClass(PrintifyOrderLog.class);
        verify(orderLogRepo).save(logCaptor.capture());
        
        PrintifyOrderLog savedLog = logCaptor.getValue();
        assertFalse(savedLog.isSuccess());
        assertEquals(429, savedLog.getHttpStatusCode());
    }

    @Test
    void testCreateOrder_5xxError_LogsServerError() {
        // Arrange
        PrintifyOrderRequest request = createTestOrderRequest();
        HttpServerErrorException exception = new HttpServerErrorException(
            HttpStatus.INTERNAL_SERVER_ERROR, "Server error", "{\"error\":\"internal\"}".getBytes(), null);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
            .thenThrow(exception);
        when(orderLogRepo.save(any(PrintifyOrderLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act & Assert
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> {
            printifyService.createOrder(request);
        });

        assertTrue(thrown.getMessage().contains("Printify API server error"));
        assertTrue(thrown.getMessage().contains("500"));

        // Verify server error was logged
        ArgumentCaptor<PrintifyOrderLog> logCaptor = ArgumentCaptor.forClass(PrintifyOrderLog.class);
        verify(orderLogRepo).save(logCaptor.capture());
        
        PrintifyOrderLog savedLog = logCaptor.getValue();
        assertFalse(savedLog.isSuccess());
        assertEquals(500, savedLog.getHttpStatusCode());
    }

    @Test
    void testCreateOrder_NetworkError_LogsNetworkFailure() {
        // Arrange
        PrintifyOrderRequest request = createTestOrderRequest();
        RestClientException exception = new RestClientException("Connection timeout");

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
            .thenThrow(exception);
        when(orderLogRepo.save(any(PrintifyOrderLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act & Assert
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> {
            printifyService.createOrder(request);
        });

        assertTrue(thrown.getMessage().contains("Failed to connect to Printify API"));

        // Verify network error was logged
        ArgumentCaptor<PrintifyOrderLog> logCaptor = ArgumentCaptor.forClass(PrintifyOrderLog.class);
        verify(orderLogRepo).save(logCaptor.capture());
        
        PrintifyOrderLog savedLog = logCaptor.getValue();
        assertFalse(savedLog.isSuccess());
        assertNull(savedLog.getHttpStatusCode()); // No HTTP status for network errors
        assertEquals("Network/connection error", savedLog.getResponsePayload());
    }

    @Test
    void testCreateOrder_LoggingFailure_DoesNotBlockOrder() {
        // Arrange
        PrintifyOrderRequest request = createTestOrderRequest();
        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("id", "order-123");

        ResponseEntity<Map<String, Object>> response = new ResponseEntity<>(responseBody, HttpStatus.OK);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
            .thenReturn(response);
        when(orderLogRepo.save(any(PrintifyOrderLog.class))).thenThrow(new RuntimeException("Firestore error"));

        // Act - should not throw despite logging failure
        Map<String, Object> result = printifyService.createOrder(request);

        // Assert - order should still succeed
        assertNotNull(result);
        assertEquals("order-123", result.get("id"));

        // Verify logging was attempted (even though it failed)
        verify(orderLogRepo).save(any(PrintifyOrderLog.class));
    }

    @Test
    void testCreateOrder_RequestPayloadSerialization_UsesObjectMapper() {
        // Arrange
        PrintifyOrderRequest request = createTestOrderRequest();
        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("id", "order-123");

        ResponseEntity<Map<String, Object>> response = new ResponseEntity<>(responseBody, HttpStatus.OK);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
            .thenReturn(response);
        when(orderLogRepo.save(any(PrintifyOrderLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        printifyService.createOrder(request);

        // Assert - verify request payload is valid JSON (serialized by ObjectMapper)
        ArgumentCaptor<PrintifyOrderLog> logCaptor = ArgumentCaptor.forClass(PrintifyOrderLog.class);
        verify(orderLogRepo).save(logCaptor.capture());
        
        PrintifyOrderLog savedLog = logCaptor.getValue();
        String requestPayload = savedLog.getRequestPayload();
        
        // Verify it's valid JSON (not toString())
        assertNotNull(requestPayload);
        assertTrue(requestPayload.startsWith("{"));
        assertTrue(requestPayload.contains("\"external_id\""));
        assertTrue(requestPayload.contains("\"line_items\""));
        
        // Verify it can be parsed back as JSON
        ObjectMapper mapper = new ObjectMapper();
        assertDoesNotThrow(() -> mapper.readTree(requestPayload));
    }

    @Test
    void testGetProducts_IncludesUserAgentHeader() {
        // Arrange
        Map<String, Object> responseBody = new HashMap<>();
        Map<String, Object> product = new HashMap<>();
        product.put("id", "prod-1");
        product.put("title", "Test Product");
        product.put("variants", List.of(new HashMap<>()));
        responseBody.put("data", List.of(product));

        ResponseEntity<Map<String, Object>> response = new ResponseEntity<>(responseBody, HttpStatus.OK);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()))
            .thenReturn(response);

        // Act
        List<Map<String, Object>> products = printifyService.getProducts();

        // Assert
        assertNotNull(products);

        // Verify headers include User-Agent
        ArgumentCaptor<HttpEntity<?>> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(anyString(), eq(HttpMethod.GET), entityCaptor.capture(), ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any());
        
        HttpEntity<?> capturedEntity = entityCaptor.getValue();
        HttpHeaders headers = capturedEntity.getHeaders();
        
        assertEquals("MissouriStateLacrosse/1.0", headers.getFirst("User-Agent"));
        assertTrue(headers.getFirst("Authorization").startsWith("Bearer"));
    }

    private PrintifyOrderRequest createTestOrderRequest() {
        PrintifyOrderRequest request = new PrintifyOrderRequest();
        request.setOrderId("test-order-123");

        ShippingInfo shipping = new ShippingInfo();
        shipping.setFirstName("John");
        shipping.setLastName("Doe");
        shipping.setEmail("john@example.com");
        shipping.setPhone("1234567890");
        shipping.setCountry("US");
        shipping.setRegion("MO");
        shipping.setAddress1("123 Main St");
        shipping.setCity("Springfield");
        shipping.setZip("65801");
        request.setShipping(shipping);

        PrintifyOrderRequest.PrintifyOrderItem item = new PrintifyOrderRequest.PrintifyOrderItem();
        item.setProductId("prod-1");
        item.setVariantId("var-1");
        item.setQuantity(1);
        request.setItems(List.of(item));

        return request;
    }
}


