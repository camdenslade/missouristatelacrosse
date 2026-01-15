package com.mostate.lacrosse.Controller.Admin;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.PrintifyOrderLog;
import com.mostate.lacrosse.Service.PrintifyOrderLogService;

@ExtendWith(MockitoExtension.class)
class PrintifyOrderLogControllerTest {

    @Mock
    private PrintifyOrderLogService orderLogService;

    @InjectMocks
    private PrintifyOrderLogController controller;

    @BeforeEach
    void setUp() {
        // Setup common mocks
    }

    @Test
    void testGetOrderLogs_AdminUser_Returns200() {
        // Arrange
        String userId = "admin-user-123";
        String program = "men";
        List<PrintifyOrderLog> logs = createTestLogs(3);

        when(orderLogService.isAdmin(userId, program)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(100)).thenReturn(logs);

        // Act
        ResponseEntity<?> response = controller.getOrderLogs(null, userId, program, 100);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody() instanceof List);
        @SuppressWarnings("unchecked")
        List<PrintifyOrderLog> result = (List<PrintifyOrderLog>) response.getBody();
        assertEquals(3, result.size());
    }

    @Test
    void testGetOrderLogs_NonAdminUser_Returns403() {
        // Arrange
        String userId = "regular-user-123";
        String program = "men";

        when(orderLogService.isAdmin(userId, program)).thenReturn(false);

        // Act
        ResponseEntity<?> response = controller.getOrderLogs(null, userId, program, 100);

        // Assert
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody() instanceof ErrorResponse);
        ErrorResponse error = (ErrorResponse) response.getBody();
        assertEquals("Admin access required", error.error());
        
        // Verify service was never called to fetch logs
        verify(orderLogService, never()).getAllOrderLogs(anyInt());
    }

    @Test
    void testGetOrderLogs_UnauthenticatedUser_Returns401() {
        // Arrange
        String userId = null; // No user ID provided
        String program = "men";

        // Act
        ResponseEntity<?> response = controller.getOrderLogs(null, userId, program, 100);

        // Assert
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody() instanceof ErrorResponse);
        ErrorResponse error = (ErrorResponse) response.getBody();
        assertEquals("User ID is required", error.error());
        
        // Verify admin check was never called
        verify(orderLogService, never()).isAdmin(anyString(), anyString());
        verify(orderLogService, never()).getAllOrderLogs(anyInt());
    }

    @Test
    void testGetOrderLogs_EmptyUserId_Returns401() {
        // Arrange
        String userId = "";
        String program = "men";

        // Act
        ResponseEntity<?> response = controller.getOrderLogs(null, userId, program, 100);

        // Assert
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void testGetOrderLogs_UserIdFromHeader_TakesPrecedence() {
        // Arrange
        String headerUserId = "header-user-123";
        String paramUserId = "param-user-456";
        String program = "men";
        List<PrintifyOrderLog> logs = createTestLogs(2);

        when(orderLogService.isAdmin(headerUserId, program)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(100)).thenReturn(logs);

        // Act
        ResponseEntity<?> response = controller.getOrderLogs(headerUserId, paramUserId, program, 100);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).isAdmin(headerUserId, program); // Should use header, not param
        verify(orderLogService, never()).isAdmin(paramUserId, program);
    }

    @Test
    void testGetOrderLogs_PaginationLimit_Enforced() {
        // Arrange
        String userId = "admin-user-123";
        String program = "men";
        List<PrintifyOrderLog> logs = createTestLogs(50);

        when(orderLogService.isAdmin(userId, program)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(50)).thenReturn(logs);

        // Act
        ResponseEntity<?> response = controller.getOrderLogs(null, userId, program, 50);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).getAllOrderLogs(50);
    }

    @Test
    void testGetOrderLogs_PaginationLimit_CappedAt500() {
        // Arrange
        String userId = "admin-user-123";
        String program = "men";
        List<PrintifyOrderLog> logs = createTestLogs(500);

        when(orderLogService.isAdmin(userId, program)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(500)).thenReturn(logs);

        // Act - request 1000, should be capped at 500
        ResponseEntity<?> response = controller.getOrderLogs(null, userId, program, 1000);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).getAllOrderLogs(500); // Should be capped
    }

    @Test
    void testGetOrderLogs_PaginationLimit_Minimum1() {
        // Arrange
        String userId = "admin-user-123";
        String program = "men";
        List<PrintifyOrderLog> logs = createTestLogs(1);

        when(orderLogService.isAdmin(userId, program)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(1)).thenReturn(logs);

        // Act - request 0, should be set to 1
        ResponseEntity<?> response = controller.getOrderLogs(null, userId, program, 0);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).getAllOrderLogs(1); // Should be minimum 1
    }

    @Test
    void testGetOrderLogs_WomenProgram_ChecksWomenRole() {
        // Arrange
        String userId = "admin-user-123";
        String program = "women";
        List<PrintifyOrderLog> logs = createTestLogs(2);

        when(orderLogService.isAdmin(userId, program)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(100)).thenReturn(logs);

        // Act
        ResponseEntity<?> response = controller.getOrderLogs(null, userId, program, 100);

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).isAdmin(userId, "women");
    }

    @Test
    void testGetOrderLogs_ServiceException_Returns500() {
        // Arrange
        String userId = "admin-user-123";
        String program = "men";

        when(orderLogService.isAdmin(userId, program)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(100)).thenThrow(new RuntimeException("Database error"));

        // Act
        ResponseEntity<?> response = controller.getOrderLogs(null, userId, program, 100);

        // Assert
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody() instanceof ErrorResponse);
        ErrorResponse error = (ErrorResponse) response.getBody();
        assertTrue(error.error().contains("Failed to fetch order logs"));
    }

    private List<PrintifyOrderLog> createTestLogs(int count) {
        List<PrintifyOrderLog> logs = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            PrintifyOrderLog log = new PrintifyOrderLog("order-" + i, "shop-1");
            log.setId(UUID.randomUUID());
            log.setTimestamp(System.currentTimeMillis() - (count - i) * 1000); // Descending timestamps
            log.setSuccess(i % 2 == 0);
            log.setHttpStatusCode(200);
            logs.add(log);
        }
        return logs;
    }
}

