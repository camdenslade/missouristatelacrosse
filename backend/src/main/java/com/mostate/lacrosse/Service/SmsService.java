package com.mostate.lacrosse.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.pinpointsmsvoicev2.PinpointSmsVoiceV2Client;
import software.amazon.awssdk.services.pinpointsmsvoicev2.model.ConflictException;
import software.amazon.awssdk.services.pinpointsmsvoicev2.model.ConflictExceptionReason;
import software.amazon.awssdk.services.pinpointsmsvoicev2.model.MessageType;
import software.amazon.awssdk.services.pinpointsmsvoicev2.model.SendTextMessageRequest;

/**
 * Texts through AWS End User Messaging SMS, off by default. It stays off until the 10DLC
 * brand and campaign are approved and SMS_ENABLED=true is set in the backend secret. The
 * number defaults to +12073673104 (application.properties). AWS manages STOP/HELP itself:
 * an opted-out number comes back as a conflict.
 */
@Service
public class SmsService {
    private static final Logger log = LoggerFactory.getLogger(SmsService.class);

    public enum Result { SENT, OPTED_OUT, FAILED, DISABLED }

    private final boolean enabled;
    private final String originationNumber;
    private final String region;
    private volatile PinpointSmsVoiceV2Client client;

    public SmsService(
        @Value("${app.sms.enabled:false}") boolean enabled,
        @Value("${app.sms.origination-number:}") String originationNumber,
        @Value("${AWS_REGION:us-east-1}") String region
    ) {
        this.originationNumber = originationNumber == null ? "" : originationNumber.trim();
        this.enabled = enabled && !this.originationNumber.isEmpty();
        this.region = region;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** US numbers only: 10 digits, or 11 starting with 1, returned as +1XXXXXXXXXX. */
    public static String normalizePhone(String raw) {
        if (raw == null) return null;
        String digits = raw.replaceAll("\\D", "");
        if (digits.length() == 11 && digits.startsWith("1")) digits = digits.substring(1);
        return digits.length() == 10 ? "+1" + digits : null;
    }

    private PinpointSmsVoiceV2Client client() {
        if (client == null) {
            synchronized (this) {
                if (client == null) {
                    client = PinpointSmsVoiceV2Client.builder()
                        .region(Region.of(region))
                        .credentialsProvider(DefaultCredentialsProvider.create())
                        .build();
                }
            }
        }
        return client;
    }

    public Result send(String toE164, String body) {
        if (!enabled) return Result.DISABLED;
        try {
            client().sendTextMessage(SendTextMessageRequest.builder()
                .destinationPhoneNumber(toE164)
                .originationIdentity(originationNumber)
                .messageBody(body)
                .messageType(MessageType.PROMOTIONAL)
                .build());
            return Result.SENT;
        } catch (ConflictException e) {
            if (e.reason() == ConflictExceptionReason.DESTINATION_PHONE_NUMBER_OPTED_OUT) return Result.OPTED_OUT;
            log.warn("SMS to {} refused: {}", toE164, e.reasonAsString());
            return Result.FAILED;
        } catch (Exception e) {
            log.warn("SMS send to {} failed: {}", toE164, e.getMessage());
            return Result.FAILED;
        }
    }
}
