"""
Backend package initializer.

"""
import flask
from authlib.integrations.flask_client import OAuth

# app is a single object used by all the code modules in this package
app = flask.Flask(__name__) 

app.config.from_object('backend.config')

app.config.from_envvar('BACKEND_SETTINGS', silent=True)

oauth = OAuth(app)
oauth.register('google',client_kwargs={'scope': 'openid profile email', 'access_type':'offline'})

import backend.api