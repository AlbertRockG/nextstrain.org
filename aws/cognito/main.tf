terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "registry.terraform.io/hashicorp/aws"
      version = "~> 4.32"
    }
  }
}

resource "aws_cognito_user_pool" "nextstrain_dot_org" {
  lifecycle {
    prevent_destroy = true
  }

  name = "nextstrain.org"

  # Alternate attributes that can be used for sign in.  While "username" is
  # immutable, "preferred_username" can be changed by the user.
  alias_attributes = ["preferred_username"]

  # Verify email automatically after creation (or change, I think).
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    # No self sign up, for now.
    allow_admin_create_user_only = true

    # Invitations sent to the user upon creation by an admin.
    invite_message_template {
      email_subject = "nextstrain.org account"
      email_message = <<-EOT
          <p>Hello!

          <p>Your Nextstrain.org username is <strong>{username}</strong> and temporary password is <strong>{####}</strong>.

          <p>Go to <a href="https://nextstrain.org/login">https://nextstrain.org/login</a> to log in. You’ll be prompted to set your own password when you do.

          <p>If you run into trouble, just reply to this message to contact us.

          <p>—the Nextstrain team
      EOT

      sms_message = "Your Nextstrain.org username is {username} and temporary password is {####}."
    }
  }

  verification_message_template {
    # Verify email addresses using a link instead a code.
    default_email_option = "CONFIRM_WITH_LINK"

    # Used for CONFIRM_WITH_LINK verification via email.
    email_subject_by_link = "Nextstrain.org email verification"
    email_message_by_link = <<-EOT
        <p>Hello!

        <p>Please click the link below to verify your email address for use on Nextstrain.org.

        <p>{##Verify Email##}

        <p>If you run into trouble, just reply to this message to contact us.

        <p>—the Nextstrain team
    EOT

    # Used for CONFIRM_WITH_CODE verification via email or sms.
    email_subject = "Your verification code"
    email_message = "Your verification code is {####}. "
    sms_message   = "Your verification code is {####}. "
  }

  # Used for MFA via SMS, which we don't enable.
  sms_authentication_message = "Your authentication code is {####}. "

  # Password reset mechanisms.
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 2
    }
    recovery_mechanism {
      name     = "verified_phone_number"
      priority = 1
    }
  }

  # Send email via our authenticated AWS SES identity for higher rate limits,
  # customized From, DKIM signing, etc.
  email_configuration {
    email_sending_account = "DEVELOPER"
    from_email_address    = "Nextstrain <hello@nextstrain.org>"
    source_arn            = "arn:aws:ses:us-east-1:827581582529:identity/hello@nextstrain.org"
  }

  # "email" is a built in standard attribute, but this reflects that we made it
  # required to create a user when we first created the user pool.
  schema {
    name     = "email"
    required = true
    mutable  = true

    attribute_data_type = "String"
    string_attribute_constraints {
      max_length = "2048"
      min_length = "0"
    }

    developer_only_attribute = false
  }

  # "allowed_sources" was added prospectively when the user pool was created,
  # but then never used in practice.  Unfortunately (and unrealized at the
  # time), custom attributes cannot be changed or removed later.
  schema {
    name     = "allowed_sources"
    required = false
    mutable  = true

    attribute_data_type = "String"
    string_attribute_constraints {
      max_length = "256"
      min_length = "1"
    }

    developer_only_attribute = false
  }
}


resource "aws_cognito_user_pool_domain" "login_dot_nextstrain_dot_org" {
  lifecycle {
    prevent_destroy = true
  }

  user_pool_id = aws_cognito_user_pool.nextstrain_dot_org.id
  domain       = "login.nextstrain.org"

  # XXX TODO: Manage this ACM certificate (and its validation) via Terraform too.
  certificate_arn = "arn:aws:acm:us-east-1:827581582529:certificate/36dc886d-d25a-4324-95c8-090a6162a528"
}

resource "aws_cognito_user_pool_domain" "cognito" {
  user_pool_id = aws_cognito_user_pool.nextstrain_dot_org.id
  domain       = "nextstrain" # i.e. nextstrain.auth.us-east-1.amazoncognito.com
}

resource "aws_cognito_user_pool_ui_customization" "default" {
  # Customizations are only valid if the pool has at least one active domain
  # associated with it.  So refer to our domain resource's user_pool_id attribute
  # (as opposed to the pool's own id attribute) to ensure Terraform gets
  # dependency ordering correct.
  user_pool_id = aws_cognito_user_pool_domain.login_dot_nextstrain_dot_org.user_pool_id
  client_id    = "ALL"

  css        = file("${path.module}/login.nextstrain.org.css")
  image_file = filebase64("${path.module}/login.nextstrain.org.png")
}
