package com.mostate.lacrosse.Controller;

import com.mostate.lacrosse.Model.AccountRequestModel;
import com.mostate.lacrosse.Service.AccountRequestService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/account-requests")
public class AccountRequestController {
    private final AccountRequestService accountRequestService;

    public AccountRequestController(AccountRequestService accountRequestService){
        this.accountRequestService = accountRequestService;
    }

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
    public ResponseEntity<List<AccountRequestModel>> getRequests(@RequestParam(defaultValue = "men") String program){
        try{
            List<AccountRequestModel> requestModels = accountRequestService.getRequests(program);
            return ResponseEntity.ok(requestModels);
        } catch (Exception e){
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/id")
    public ResponseEntity<String> rejectRequest(@PathVariable String id, @RequestParam(defaultValue = "men") String program){
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

    @PostMapping("/{id}/approve")
    public ResponseEntity <String> approveRequest(@PathVariable String id, @RequestParam(defaultValue = "men") String program){
        try{
            accountRequestService.approveRequest(id, program);
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
}
