import backend
from flask import Flask,url_for, render_template,redirect
import flask
import time

def verify_login(func):
    def wrapper():
        if 'credentials' not in flask.session:
            return redirect('/login/')
        else:
            if time.time() > flask.session['credentials']['expires_at']:
                return redirect('/login/')
        return func()
    wrapper.__name__ = func.__name__
    return wrapper

@backend.app.route('/logout/')
def logout():
    flask.session.clear()
    return "You have been logged out"

@backend.app.route('/login/')
def login():
    redirect_uri = url_for('authorize', _external=True)
    return backend.oauth.google.authorize_redirect(redirect_uri)

@backend.app.route('/authorize/')
def authorize():
    token = backend.oauth.google.authorize_access_token()
    resp = backend.oauth.google.get('https://www.googleapis.com/oauth2/v2/userinfo')
    profile = resp.json()
    flask.session['credentials'] = token
    flask.session['name'] = profile['name']
    return redirect('/api/ping/')

@backend.app.route('/api/ping/')
@verify_login
def ping():
    return "pong"
