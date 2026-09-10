package com.mostate.lacrosse.Controller;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
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
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Model.Todo;
import com.mostate.lacrosse.Model.TodoStatus;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.TodoRepository;
import com.mostate.lacrosse.Repository.TodoStatusRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.PlayerProfileService;
import com.mostate.lacrosse.Service.S3Service;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/todos")
public class TodoController {

    private final TodoRepository todoRepo;
    private final TodoStatusRepository statusRepo;
    private final PlayerRepository playerRepo;
    private final AuthorizationService authorizationService;
    private final PlayerProfileService profileService;
    private final S3Service s3Service;

    private static final java.time.Duration IMAGE_TTL = S3Service.IMAGE_TTL;

    public TodoController(
        TodoRepository todoRepo,
        TodoStatusRepository statusRepo,
        PlayerRepository playerRepo,
        AuthorizationService authorizationService,
        PlayerProfileService profileService,
        S3Service s3Service
    ) {
        this.todoRepo = todoRepo;
        this.statusRepo = statusRepo;
        this.playerRepo = playerRepo;
        this.authorizationService = authorizationService;
        this.profileService = profileService;
        this.s3Service = s3Service;
    }

    @GetMapping
    public ResponseEntity<?> list(
        HttpServletRequest request,
        @RequestParam String season,
        @RequestParam(defaultValue = "men") String program
    ) {
        boolean admin = isAdmin(request, program);
        List<Todo> todos = admin
            ? todoRepo.findBySeason(season)
            : todoRepo.findBySeasonAndActiveTrue(season);
        return ResponseEntity.ok(todos.stream().map(this::toResponse).toList());
    }

    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody TodoRequest body
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        if (body.title() == null || body.title().isBlank() || body.season() == null || body.season().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Season and title are required"));
        }
        Todo todo = new Todo();
        todo.setSeason(body.season());
        todo.setTitle(body.title());
        todo.setDescription(body.description());
        todo.setLink(body.link());
        if (body.image() != null) {
            todo.setImage(body.image().isBlank() ? null : s3Service.extractKey(body.image()));
        }
        todo.setActive(body.active() == null || body.active());
        return ResponseEntity.ok(toResponse(todoRepo.save(todo)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody TodoRequest body
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Todo todo = todoRepo.findById(id).orElse(null);
        if (todo == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("To-do not found"));
        }
        if (body.season() != null) todo.setSeason(body.season());
        if (body.title() != null) todo.setTitle(body.title());
        if (body.description() != null) todo.setDescription(body.description());
        if (body.link() != null) todo.setLink(body.link());
        if (body.image() != null) {
            todo.setImage(body.image().isBlank() ? null : s3Service.extractKey(body.image()));
        }
        if (body.active() != null) todo.setActive(body.active());
        return ResponseEntity.ok(toResponse(todoRepo.save(todo)));
    }

    private TodoResponse toResponse(Todo t) {
        return new TodoResponse(
            t.getId(), t.getSeason(), t.getTitle(), t.getDescription(), t.getLink(),
            s3Service.toPresignedUrl(t.getImage(), IMAGE_TTL),
            t.isActive(), t.getCreatedAt(), t.getUpdatedAt()
        );
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> delete(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        statusRepo.deleteByTodoId(id);
        todoRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @GetMapping("/status")
    public ResponseEntity<?> statusForPlayer(
        HttpServletRequest request,
        @RequestParam UUID playerId,
        @RequestParam(defaultValue = "men") String program
    ) {
        Player player = playerRepo.findById(playerId).orElse(null);
        if (player == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
        }
        if (!isSelfOrAdmin(request, player, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized for this player"));
        }
        return ResponseEntity.ok(statusRepo.findByPlayerId(playerId));
    }

    @PutMapping("/status")
    public ResponseEntity<?> upsertStatus(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody StatusRequest body
    ) {
        Player player = playerRepo.findById(body.playerId()).orElse(null);
        if (player == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
        }
        if (!isSelfOrAdmin(request, player, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized for this player"));
        }
        if (todoRepo.findById(body.todoId()).isEmpty()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("To-do not found"));
        }

        TodoStatus status = statusRepo
            .findByTodoIdAndPlayerId(body.todoId(), body.playerId())
            .orElseGet(TodoStatus::new);
        status.setTodoId(body.todoId());
        status.setPlayerId(body.playerId());
        status.setDone(body.done());
        status.setDoneAt(body.done() ? Instant.now() : null);
        status.setMarkedByUid((String) request.getAttribute("firebaseUid"));
        return ResponseEntity.ok(statusRepo.save(status));
    }

    @GetMapping("/{id}/completions")
    public ResponseEntity<?> completions(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Todo todo = todoRepo.findById(id).orElse(null);
        if (todo == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("To-do not found"));
        }
        List<Player> seasonPlayers = playerRepo.findAllBySeason(todo.getSeason());
        Map<UUID, TodoStatus> statusByPlayer = statusRepo.findByTodoId(id).stream()
            .collect(Collectors.toMap(TodoStatus::getPlayerId, s -> s));

        List<CompletionEntry> entries = seasonPlayers.stream()
            .map(p -> {
                TodoStatus s = statusByPlayer.get(p.getId());
                return new CompletionEntry(
                    p.getId(),
                    p.getName(),
                    s != null && s.isDone(),
                    s != null ? s.getDoneAt() : null
                );
            })
            .collect(Collectors.toList());
        return ResponseEntity.ok(entries);
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    private boolean isSelfOrAdmin(HttpServletRequest request, Player player, String program) {
        if (isAdmin(request, program)) {
            return true;
        }
        String uid = (String) request.getAttribute("firebaseUid");
        return profileService.isSelf(player, uid);
    }

    public record TodoRequest(
        String season,
        String title,
        String description,
        String link,
        String image,
        Boolean active
    ) {}

    public record TodoResponse(
        UUID id,
        String season,
        String title,
        String description,
        String link,
        String image,
        boolean active,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record StatusRequest(
        UUID todoId,
        UUID playerId,
        boolean done
    ) {}

    public record CompletionEntry(
        UUID playerId,
        String playerName,
        boolean done,
        Instant doneAt
    ) {}
}
