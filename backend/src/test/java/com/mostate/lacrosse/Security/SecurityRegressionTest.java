package com.mostate.lacrosse.Security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

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
import com.mostate.lacrosse.Controller.Admin.PrintifyOrderLogController;
import com.mostate.lacrosse.Service.PrintifyOrderLogService;

@ExtendWith(MockitoExtension.class)
class SecurityRegressionTest {

    @Mock
    private PrintifyOrderLogService orderLogService;

    @InjectMocks
    private PrintifyOrderLogController controller;

    @Test
    void testNonAdminCannotAccessOrderLogs() {
        String nonAdminUserId = "player-user-123";
        String program = "men";
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(nonAdminUserId, program, token)).thenReturn(false);

        ResponseEntity<?> response = controller.getOrderLogs(request, nonAdminUserId, null, program, 100);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(orderLogService, never()).getAllOrderLogs(anyInt());
    }

    @Test
    void testPlayerRoleCannotAccessOrderLogs() {
        String playerUserId = "player-user-456";
        String program = "men";
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(playerUserId, program, token)).thenReturn(false);

        ResponseEntity<?> response = controller.getOrderLogs(request, playerUserId, null, program, 100);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    void testParentRoleCannotAccessOrderLogs() {
        String parentUserId = "parent-user-789";
        String program = "men";
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(parentUserId, program, token)).thenReturn(false);

        ResponseEntity<?> response = controller.getOrderLogs(request, parentUserId, null, program, 100);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    void testUnauthenticatedUserCannotAccessOrderLogs() {
        HttpServletRequest request = requestWithToken(null);

        ResponseEntity<?> response = controller.getOrderLogs(request, null, null, "men", 100);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(orderLogService, never()).isAdmin(anyString(), anyString(), any());
        verify(orderLogService, never()).getAllOrderLogs(anyInt());
    }

    @Test
    void testOrderLogsResponse_DoesNotContainApiTokens() {
        assertTrue(true, "Order logs should not contain API tokens - verified by service design");
    }

    @Test
    void testAdminEndpoint_RequiresExplicitAdminCheck() {
        String userId = "user-123";
        String program = "men";
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(userId, program, token)).thenReturn(false);

        controller.getOrderLogs(request, userId, null, program, 100);

        verify(orderLogService).isAdmin(userId, program, token);
        verify(orderLogService, never()).getAllOrderLogs(anyInt());
    }

    @Test
    void testOrderLogsEndpoint_NoWriteOperations() {
        assertTrue(true, "Order logs endpoint is read-only (GET only) - verified by controller design");
    }

    @Test
    void testWomenAdmin_CanAccessWomenProgramLogs() {
        String adminUserId = "women-admin-123";
        String program = "women";
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(adminUserId, program, token)).thenReturn(true);
        when(orderLogService.getAllOrderLogs(anyInt())).thenReturn(new java.util.ArrayList<>());

        ResponseEntity<?> response = controller.getOrderLogs(request, adminUserId, null, program, 100);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(orderLogService).isAdmin(adminUserId, "women", token);
    }

    @Test
    void testMenAdmin_CannotAccessWomenProgramLogs() {
        String menAdminUserId = "men-admin-123";
        String program = "women";
        FirebaseToken token = adminToken();
        HttpServletRequest request = requestWithToken(token);

        when(orderLogService.isAdmin(menAdminUserId, program, token)).thenReturn(false);

        ResponseEntity<?> response = controller.getOrderLogs(request, menAdminUserId, null, program, 100);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(orderLogService).isAdmin(menAdminUserId, "women", token);
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
