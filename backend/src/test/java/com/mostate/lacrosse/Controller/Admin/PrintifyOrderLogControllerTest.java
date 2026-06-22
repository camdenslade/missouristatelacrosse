package com.mostate.lacrosse.Controller.Admin;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.PrintifyOrderLog;
import com.mostate.lacrosse.Service.PrintifyOrderLogService;

@ExtendWith(MockitoExtension.class)
class PrintifyOrderLogControllerTest {

    @Mock
    private PrintifyOrderLogService orderLogService;

    @InjectMocks
    private PrintifyOrderLogController controller;

    @Test
    void testGetOrderLogs_AdminUser_Returns200() {
        String userId = "admin-user-123";
        String program = "men";
        List<PrintifyOrderLog> logs = createTestLogs(3);
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(userId, program, token)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(100)).thenReturn(logs);

        ResponseEntity<?> response = controller.getOrderLogs(request, userId, null, program, 100);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody() instanceof List);
        @SuppressWarnings("unchecked")
        List<PrintifyOrderLog> result = (List<PrintifyOrderLog>) response.getBody();
        assertEquals(3, result.size());
    }

    @Test
    void testGetOrderLogs_NonAdminUser_Returns403() {
        String userId = "regular-user-123";
        String program = "men";
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(userId, program, token)).thenReturn(false);

        ResponseEntity<?> response = controller.getOrderLogs(request, userId, null, program, 100);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody() instanceof ErrorResponse);
        ErrorResponse error = (ErrorResponse) response.getBody();
        assertEquals("Admin access required", error.error());

        verify(orderLogService, never()).getAllOrderLogs(anyInt());
    }

    @Test
    void testGetOrderLogs_UnauthenticatedUser_Returns401() {
        String userId = null;
        String program = "men";
        HttpServletRequest request = requestWithToken(null);

        ResponseEntity<?> response = controller.getOrderLogs(request, userId, null, program, 100);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody() instanceof ErrorResponse);
        ErrorResponse error = (ErrorResponse) response.getBody();
        assertEquals("User ID is required", error.error());

        verify(orderLogService, never()).isAdmin(anyString(), anyString(), any());
        verify(orderLogService, never()).getAllOrderLogs(anyInt());
    }

    @Test
    void testGetOrderLogs_EmptyUserId_Returns401() {
        String userId = "";
        String program = "men";
        HttpServletRequest request = requestWithToken(null);

        ResponseEntity<?> response = controller.getOrderLogs(request, userId, null, program, 100);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void testGetOrderLogs_UserIdFromHeader_TakesPrecedence() {
        String headerUserId = "header-user-123";
        String paramUserId = "param-user-456";
        String program = "men";
        List<PrintifyOrderLog> logs = createTestLogs(2);
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(headerUserId, program, token)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(100)).thenReturn(logs);

        ResponseEntity<?> response = controller.getOrderLogs(request, headerUserId, paramUserId, program, 100);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).isAdmin(headerUserId, program, token);
        verify(orderLogService, never()).isAdmin(eq(paramUserId), anyString(), any());
    }

    @Test
    void testGetOrderLogs_PaginationLimit_Enforced() {
        String userId = "admin-user-123";
        String program = "men";
        List<PrintifyOrderLog> logs = createTestLogs(50);
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(userId, program, token)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(50)).thenReturn(logs);

        ResponseEntity<?> response = controller.getOrderLogs(request, userId, null, program, 50);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).getAllOrderLogs(50);
    }

    @Test
    void testGetOrderLogs_PaginationLimit_CappedAt500() {
        String userId = "admin-user-123";
        String program = "men";
        List<PrintifyOrderLog> logs = createTestLogs(500);
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(userId, program, token)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(500)).thenReturn(logs);

        ResponseEntity<?> response = controller.getOrderLogs(request, userId, null, program, 1000);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).getAllOrderLogs(500);
    }

    @Test
    void testGetOrderLogs_PaginationLimit_Minimum1() {
        String userId = "admin-user-123";
        String program = "men";
        List<PrintifyOrderLog> logs = createTestLogs(1);
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(userId, program, token)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(1)).thenReturn(logs);

        ResponseEntity<?> response = controller.getOrderLogs(request, userId, null, program, 0);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).getAllOrderLogs(1);
    }

    @Test
    void testGetOrderLogs_WomenProgram_ChecksWomenRole() {
        String userId = "admin-user-123";
        String program = "women";
        List<PrintifyOrderLog> logs = createTestLogs(2);
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(userId, program, token)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(100)).thenReturn(logs);

        ResponseEntity<?> response = controller.getOrderLogs(request, userId, null, program, 100);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).isAdmin(userId, "women", token);
    }

    @Test
    void testGetOrderLogs_ServiceException_Returns500() {
        String userId = "admin-user-123";
        String program = "men";
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(userId, program, token)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(100)).thenThrow(new RuntimeException("Database error"));

        ResponseEntity<?> response = controller.getOrderLogs(request, userId, null, program, 100);

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
            log.setTimestamp(System.currentTimeMillis() - (count - i) * 1000);
            log.setSuccess(i % 2 == 0);
            log.setHttpStatusCode(200);
            logs.add(log);
        }
        return logs;
    }

    private FirebaseToken adminToken() {
        return mock(FirebaseToken.class);
    }

    private HttpServletRequest requestWithToken(FirebaseToken token) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        if (token != null) {
            when(request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR)).thenReturn(token);
        }
        return request;
    }
}
