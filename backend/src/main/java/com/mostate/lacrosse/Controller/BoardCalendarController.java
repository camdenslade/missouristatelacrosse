package com.mostate.lacrosse.Controller;

import java.time.LocalDate;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.BoardCalendarEvent;
import com.mostate.lacrosse.Repository.BoardCalendarEventRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;

/** A board-only shared calendar. Board members and up can add/edit/remove entries. */
@RestController
@RequestMapping("/api/board-calendar")
public class BoardCalendarController {
    private final BoardCalendarEventRepository repository;
    private final AuthorizationService authorizationService;

    public BoardCalendarController(BoardCalendarEventRepository repository, AuthorizationService authorizationService) {
        this.repository = repository;
        this.authorizationService = authorizationService;
    }

    private boolean isBoard(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isBoardOrAbove(uid, program, token);
    }

    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest request, @RequestParam(defaultValue = "men") String program) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        return ResponseEntity.ok(repository.findAllByOrderByEventDateAsc());
    }

    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody EventRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        if (body.title() == null || body.title().isBlank() || body.eventDate() == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Title and date are required"));
        }
        BoardCalendarEvent event = new BoardCalendarEvent();
        event.setCreatedBy((String) request.getAttribute("firebaseUid"));
        applyPayload(event, body);
        return ResponseEntity.ok(repository.save(event));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody EventRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        BoardCalendarEvent event = repository.findById(id).orElse(null);
        if (event == null) {
            return ResponseEntity.notFound().build();
        }
        applyPayload(event, body);
        return ResponseEntity.ok(repository.save(event));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void applyPayload(BoardCalendarEvent event, EventRequest body) {
        if (body.title() != null) event.setTitle(TextSanitizer.clean(body.title()));
        if (body.eventDate() != null) event.setEventDate(body.eventDate());
        if (body.notes() != null) event.setNotes(TextSanitizer.clean(body.notes()));
    }

    public record EventRequest(String title, LocalDate eventDate, String notes) {}
}
