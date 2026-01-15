package com.mostate.lacrosse.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Dto.IdResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import com.mostate.lacrosse.Model.SponsorRequest;
import com.mostate.lacrosse.Repository.SponsorRequestRepository;
import com.mostate.lacrosse.Utils.TextSanitizer;

@RestController
@RequestMapping("/api/sponsor-request")
@Validated
public class SponsorRequestController {
    private final SponsorRequestRepository sponsorRequestRepository;

    public SponsorRequestController(SponsorRequestRepository sponsorRequestRepository) {
        this.sponsorRequestRepository = sponsorRequestRepository;
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody SponsorRequestPayload payload){
        try{
            SponsorRequest sponsorRequest = new SponsorRequest();
            sponsorRequest.setBusinessName(TextSanitizer.clean(payload.businessName()));
            sponsorRequest.setContactInfo(TextSanitizer.clean(payload.contactInfo()));
            sponsorRequest.setRequest(TextSanitizer.clean(payload.request()));

            SponsorRequest saved = sponsorRequestRepository.save(sponsorRequest);

            return ResponseEntity.ok(new IdResponse(saved.getId().toString()));
        } catch (Exception e){
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    public record SponsorRequestPayload(
        @NotBlank String businessName,
        @NotBlank String contactInfo,
        @NotBlank String request
    ) {}
}


