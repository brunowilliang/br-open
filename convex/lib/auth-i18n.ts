import type { TranslationDictionary } from "@better-auth/i18n";

export const authTranslations = {
  "pt-BR": {
    ACCESS_DENIED: "Acesso negado.",
    ACCOUNT_NOT_FOUND: "Conta não encontrada.",
    ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY:
      "Usuários anônimos não podem entrar anonimamente novamente.",
    ASYNC_VALIDATION_NOT_SUPPORTED: "Validação assíncrona não é suportada.",
    AUTHENTICATION_REQUIRED: "Autenticação obrigatória.",
    AUTHORIZATION_PENDING: "Autorização pendente.",
    BACKUP_CODES_NOT_ENABLED: "Códigos de backup não estão habilitados.",
    BANNED_USER: "Você foi banido desta aplicação.",
    BODY_MUST_BE_AN_OBJECT: "O corpo da requisição deve ser um objeto.",
    CALLBACK_URL_REQUIRED: "callbackURL é obrigatória.",
    CANNOT_DELETE_A_PRE_DEFINED_ROLE:
      "Não é possível excluir uma função predefinida.",
    COULD_NOT_CREATE_SESSION: "Não foi possível criar a sessão.",
    CREDENTIAL_ACCOUNT_NOT_FOUND: "Conta com senha não encontrada.",
    CROSS_SITE_NAVIGATION_LOGIN_BLOCKED:
      "Login por navegação entre sites bloqueado. Esta solicitação parece ser um ataque CSRF.",
    DELETE_ANONYMOUS_USER_DISABLED:
      "A exclusão de usuários anônimos está desabilitada.",
    DEVICE_CODE_ALREADY_PROCESSED: "Código do dispositivo já foi processado.",
    EMAIL_ALREADY_VERIFIED: "E-mail já verificado.",
    EMAIL_CAN_NOT_BE_UPDATED: "O e-mail não pode ser atualizado.",
    EMAIL_MISMATCH: "E-mails não correspondem.",
    EMAIL_NOT_VERIFIED: "E-mail não verificado.",
    EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION:
      "É necessário verificar o e-mail antes de aceitar ou recusar o convite.",
    EXPIRED_DEVICE_CODE: "Código do dispositivo expirado.",
    EXPIRED_USER_CODE: "Código do usuário expirado.",
    FAILED_TO_CREATE_SESSION: "Não foi possível criar a sessão.",
    FAILED_TO_CREATE_USER: "Não foi possível criar o usuário.",
    FAILED_TO_CREATE_VERIFICATION: "Não foi possível criar a verificação.",
    FAILED_TO_DELETE_ANONYMOUS_USER:
      "Não foi possível excluir o usuário anônimo.",
    FAILED_TO_GET_SESSION: "Não foi possível obter a sessão.",
    FAILED_TO_GET_USER_INFO:
      "Não foi possível obter as informações do usuário.",
    FAILED_TO_RETRIEVE_INVITATION: "Não foi possível recuperar o convite.",
    FAILED_TO_UNLINK_LAST_ACCOUNT:
      "Você não pode desvincular sua última conta.",
    FAILED_TO_UPDATE_USER: "Não foi possível atualizar o usuário.",
    FIELD_NOT_ALLOWED: "Campo não permitido.",
    ID_TOKEN_NOT_SUPPORTED: "id_token não é suportado.",
    INVALID_BACKUP_CODE: "Código de backup inválido.",
    INVALID_CALLBACK_URL: "callbackURL inválida.",
    INVALID_CODE: "Código inválido.",
    INVALID_DEVICE_CODE: "Código do dispositivo inválido.",
    INVALID_DEVICE_CODE_STATUS: "Status do código do dispositivo inválido.",
    INVALID_DISPLAY_USERNAME: "Nome de exibição inválido.",
    INVALID_EMAIL: "E-mail inválido.",
    INVALID_EMAIL_FORMAT: "O e-mail gerado não está em um formato válido.",
    INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha inválidos.",
    INVALID_ERROR_CALLBACK_URL: "errorCallbackURL inválida.",
    INVALID_NEW_USER_CALLBACK_URL: "newUserCallbackURL inválida.",
    INVALID_OAUTH_CONFIG: "Configuração OAuth inválida.",
    INVALID_OAUTH_CONFIGURATION: "Configuração OAuth inválida.",
    INVALID_ORIGIN: "Origem inválida.",
    INVALID_OTP: "Código OTP inválido.",
    INVALID_PASSWORD: "Senha inválida.",
    INVALID_PHONE_NUMBER: "Telefone inválido.",
    INVALID_PHONE_NUMBER_OR_PASSWORD: "Telefone ou senha inválidos.",
    INVALID_REDIRECT_URL: "redirectURL inválida.",
    INVALID_RESOURCE: "A permissão informada contém um recurso inválido.",
    INVALID_ROLE_TYPE: "Tipo de função inválido.",
    INVALID_SESSION_TOKEN: "Token de sessão inválido.",
    INVALID_TOKEN: "Token inválido.",
    INVALID_TWO_FACTOR_COOKIE:
      "Cookie de autenticação de dois fatores inválido.",
    INVALID_USER: "Usuário inválido.",
    INVALID_USER_CODE: "Código do usuário inválido.",
    INVALID_USERNAME: "Nome de usuário inválido.",
    INVALID_USERNAME_OR_PASSWORD: "Nome de usuário ou senha inválidos.",
    INVITATION_LIMIT_REACHED: "Limite de convites atingido.",
    INVITATION_NOT_FOUND: "Convite não encontrado.",
    INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION:
      "Quem enviou o convite não é mais membro da organização.",
    ISSUER_MISMATCH:
      "Emissor OAuth não corresponde ao valor esperado pelo servidor de autorização.",
    ISSUER_MISSING:
      "Parâmetro de emissor OAuth ausente na resposta do servidor de autorização.",
    LINKED_ACCOUNT_ALREADY_EXISTS: "Conta vinculada já existe.",
    MEMBER_NOT_FOUND: "Membro não encontrado.",
    METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED:
      "O método POST exige que deferSessionRefresh esteja habilitado na configuração da sessão.",
    MISSING_AC_INSTANCE:
      "Controle de acesso dinâmico exige uma instância ac predefinida no plugin de autenticação do servidor.",
    MISSING_FIELD: "Campo obrigatório.",
    MISSING_OR_NULL_ORIGIN: "Origin ausente ou nula.",
    MISSING_RESPONSE: "Resposta do CAPTCHA ausente.",
    MISSING_SECRET_KEY: "Chave secreta ausente.",
    NO_ACTIVE_ORGANIZATION: "Nenhuma organização ativa.",
    NO_DATA_TO_UPDATE: "Nenhum dado para atualizar.",
    ORGANIZATION_ALREADY_EXISTS: "Organização já existe.",
    ORGANIZATION_MEMBERSHIP_LIMIT_REACHED:
      "Limite de membros da organização atingido.",
    ORGANIZATION_NOT_FOUND: "Organização não encontrada.",
    ORGANIZATION_SLUG_ALREADY_TAKEN: "Slug da organização já está em uso.",
    OTP_EXPIRED: "Código OTP expirado.",
    OTP_HAS_EXPIRED: "Código OTP expirou.",
    OTP_NOT_ENABLED: "OTP não está habilitado.",
    OTP_NOT_FOUND: "Código OTP não encontrado.",
    PASSWORD_ALREADY_SET: "Usuário já possui uma senha definida.",
    PASSWORD_TOO_LONG: "Senha muito longa.",
    PASSWORD_TOO_SHORT: "Senha muito curta.",
    PHONE_NUMBER_CANNOT_BE_UPDATED: "O telefone não pode ser atualizado.",
    PHONE_NUMBER_EXIST: "Telefone já existe.",
    PHONE_NUMBER_NOT_EXIST: "Telefone não está cadastrado.",
    PHONE_NUMBER_NOT_VERIFIED: "Telefone não verificado.",
    POLLING_TOO_FREQUENTLY: "Tentativas muito frequentes.",
    PROVIDER_CONFIG_NOT_FOUND: "Configuração do provedor não encontrada.",
    PROVIDER_ID_REQUIRED: "ID do provedor é obrigatório.",
    PROVIDER_NOT_FOUND: "Provedor não encontrado.",
    ROLE_IS_ASSIGNED_TO_MEMBERS:
      "Não é possível excluir uma função atribuída a membros. Reatribua os membros para outra função primeiro.",
    ROLE_NAME_IS_ALREADY_TAKEN: "Esse nome de função já está em uso.",
    ROLE_NOT_FOUND: "Função não encontrada.",
    SEND_OTP_NOT_IMPLEMENTED: "sendOTP não foi implementado.",
    SERVICE_UNAVAILABLE: "Serviço indisponível.",
    SESSION_EXPIRED: "Sessão expirada.",
    SESSION_NOT_FRESH: "A sessão não é recente.",
    SESSION_REQUIRED: "Sessão obrigatória.",
    SOCIAL_ACCOUNT_ALREADY_LINKED: "Conta social já vinculada.",
    TEAM_ALREADY_EXISTS: "Equipe já existe.",
    TEAM_MEMBER_LIMIT_REACHED: "Limite de membros da equipe atingido.",
    TEAM_NOT_FOUND: "Equipe não encontrada.",
    TOKEN_EXPIRED: "Token expirado.",
    TOKEN_URL_NOT_FOUND:
      "Configuração OAuth inválida. URL do token não encontrada.",
    TOO_MANY_ATTEMPTS: "Muitas tentativas.",
    TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE:
      "Muitas tentativas. Solicite um novo código.",
    TOO_MANY_ROLES: "Esta organização possui muitas funções.",
    TOTP_NOT_ENABLED: "TOTP não está habilitado.",
    TWO_FACTOR_NOT_ENABLED: "Autenticação de dois fatores não está habilitada.",
    UNABLE_TO_REMOVE_LAST_TEAM: "Não é possível remover a última equipe.",
    UNEXPECTED_ERROR: "Erro inesperado.",
    UNKNOWN_ERROR: "Algo deu errado.",
    USER_ALREADY_EXISTS: "Usuário já existe.",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
      "Usuário já existe. Use outro e-mail.",
    USER_ALREADY_HAS_PASSWORD:
      "Usuário já possui uma senha. Informe essa senha para excluir a conta.",
    USER_EMAIL_NOT_FOUND: "E-mail do usuário não encontrado.",
    USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION:
      "Usuário já é membro desta organização.",
    USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION:
      "Usuário já foi convidado para esta organização.",
    USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION:
      "Usuário não é membro da organização.",
    USER_IS_NOT_A_MEMBER_OF_THE_TEAM: "Usuário não é membro da equipe.",
    USER_IS_NOT_ANONYMOUS: "Usuário não é anônimo.",
    USER_NOT_FOUND: "Usuário não encontrado.",
    USERNAME_IS_ALREADY_TAKEN: "Nome de usuário já está em uso. Tente outro.",
    USERNAME_TOO_LONG: "Nome de usuário muito longo.",
    USERNAME_TOO_SHORT: "Nome de usuário muito curto.",
    VALIDATION_ERROR: "Erro de validação.",
    VERIFICATION_EMAIL_NOT_ENABLED:
      "E-mail de verificação não está habilitado.",
    VERIFICATION_FAILED: "Falha na verificação.",
    YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION:
      "Você não é membro desta organização.",
    YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION:
      "Você não tem permissão para acessar esta organização como proprietário.",
    YOU_ARE_NOT_ALLOWED_TO_BAN_USERS:
      "Você não tem permissão para banir usuários.",
    YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION:
      "Você não tem permissão para cancelar este convite.",
    YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE:
      "Você não tem permissão para alterar a função dos usuários.",
    YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION:
      "Você não tem permissão para criar uma nova organização.",
    YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM:
      "Você não tem permissão para criar uma nova equipe.",
    YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER:
      "Você não tem permissão para criar um novo membro.",
    YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE:
      "Você não tem permissão para criar uma função.",
    YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION:
      "Você não tem permissão para criar equipes nesta organização.",
    YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS:
      "Você não tem permissão para criar usuários.",
    YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE:
      "Você não tem permissão para excluir uma função.",
    YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION:
      "Você não tem permissão para excluir equipes nesta organização.",
    YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER:
      "Você não tem permissão para excluir este membro.",
    YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION:
      "Você não tem permissão para excluir esta organização.",
    YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM:
      "Você não tem permissão para excluir esta equipe.",
    YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS:
      "Você não tem permissão para excluir usuários.",
    YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE:
      "Você não tem permissão para obter uma função.",
    YOU_ARE_NOT_ALLOWED_TO_GET_USER:
      "Você não tem permissão para obter o usuário.",
    YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS:
      "Você não tem permissão para assumir usuários.",
    YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE:
      "Você não tem permissão para convidar um usuário com esta função.",
    YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION:
      "Você não tem permissão para convidar usuários para esta organização.",
    YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE:
      "Você não tem permissão para listar funções.",
    YOU_ARE_NOT_ALLOWED_TO_LIST_USERS:
      "Você não tem permissão para listar usuários.",
    YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS:
      "Você não tem permissão para listar sessões dos usuários.",
    YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE:
      "Você não tem permissão para ler uma função.",
    YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER:
      "Você não tem permissão para remover um membro da equipe.",
    YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS:
      "Você não tem permissão para revogar sessões dos usuários.",
    YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE:
      "Você não tem permissão para definir uma função inexistente.",
    YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD:
      "Você não tem permissão para definir a senha dos usuários.",
    YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE:
      "Você não tem permissão para atualizar uma função.",
    YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER:
      "Você não tem permissão para atualizar este membro.",
    YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION:
      "Você não tem permissão para atualizar esta organização.",
    YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM:
      "Você não tem permissão para atualizar esta equipe.",
    YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS:
      "Você não tem permissão para atualizar usuários.",
    YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION:
      "Você não é o destinatário do convite.",
    YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM:
      "Você não tem permissão para listar os membros desta equipe.",
    YOU_CANNOT_BAN_YOURSELF: "Você não pode banir a si mesmo.",
    YOU_CANNOT_IMPERSONATE_ADMINS: "Você não pode assumir administradores.",
    YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER:
      "Você não pode sair da organização sendo o único proprietário.",
    YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER:
      "Você não pode sair da organização sem deixar um proprietário.",
    YOU_CANNOT_REMOVE_YOURSELF: "Você não pode remover a si mesmo.",
    YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM: "Você não possui uma equipe ativa.",
    YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS:
      "Você atingiu o número máximo de organizações.",
    YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS:
      "Você atingiu o número máximo de equipes.",
    YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE:
      "Você precisa estar em uma organização para criar uma função.",
  } as TranslationDictionary,
} as const;
