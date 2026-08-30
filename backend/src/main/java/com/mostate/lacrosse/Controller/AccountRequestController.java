package com.mostate.lacrosse.Controller;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.AccountRequestModel;
import com.mostate.lacrosse.Service.AccountRequestService;
import com.mostate.lacrosse.Service.AuthorizationService;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("api/account-requests")
public class AccountRequestController {
    private final AccountRequestService accountRequestService;
    private final AuthorizationService authorizationService;

    public AccountRequestController(
        AccountRequestService accountRequestService,
        AuthorizationService authorizationService
    ){
        this.accountRequestService = accountRequestService;
        this.authorizationService = authorizationService;
    }

    // Public/self-service: anyone can request access — that's the whole point of this form.
    @PostMapping
    public ResponseEntity<String> createRequest(@RequestBody AccountRequestModel requestModel){
        try{
            String id = accountRequestService.createRequest(requestModel);
            return ResponseEntity.ok(id);
        } catch (Exception e){
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error creating request: " + e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> getRequests(HttpServletRequest request, @RequestParam(defaultValue = "men") String program){
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        try{
            List<AccountRequestModel> requestModels = accountRequestService.getRequests(program);
            return ResponseEntity.ok(requestModels);
        } catch (Exception e){
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> rejectRequest(HttpServletRequest request, @PathVariable String id, @RequestParam(defaultValue = "men") String program){
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        try{
            accountRequestService.rejectRequest(id, program);
            return ResponseEntity.ok("Request Rejected.");
        } catch (IllegalArgumentException e){
            return ResponseEntity.notFound().build();
        } catch (Exception e){
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error rejecting request: " + e.getMessage());
        }
    }

    // CRITICAL: this grants a role (including "admin") to the requester's new account —
    // must never be reachable without an admin caller.
    @PostMapping("/{id}/approve")
    public ResponseEntity<?> approveRequest(
        HttpServletRequest request,
        @PathVariable String id,
        @RequestParam(defaultValue = "men") String program,
        @RequestParam(defaultValue = "user") String role
    ){
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        try{
            accountRequestService.approveRequest(id, program, role);
            return ResponseEntity.ok("Request approved.");
        } catch (IllegalArgumentException e){
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e){
            return ResponseEntity.badRequest().body("Invalid state: " + e.getMessage());
        } catch (Exception e){
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error approving request: " + e.getMessage());
        }
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }
}
