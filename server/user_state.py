class UserState:
    """
    State Management for the agent server
    """
    def __init__(self):
        self.actions = []
        self.user_model = ""
        self.socket = ''

    # Add actions to state
    def add_actions(self, action: str):
        self.actions.append(action)

    # Get actions from state
    def get_actions(self):
        return self.actions

    # Set user model received from state
    def set_user_model(self, model: str):
        self.user_model = model

    # Get user model from state
    def get_user_model(self):
        return self.user_model

    # Set Socket for global use
    def set_socket(self, socket):
        self.socket = socket

    # Get socket from state
    def get_socket(self):
        return self.socket
