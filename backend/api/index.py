import backend
from flask import Flask,url_for, render_template,redirect
import flask
import time
import requests

def verify_login(func):
    def wrapper():
        if 'credentials' not in flask.session:
            return redirect('/login/')
        else:
            url = backend.app.config["TOKEN_INFO_URL"] + flask.session['credentials']['id_token']
            response = requests.get(url)
            
            if not response:
                return redirect('/login/')
            
            if response.status_code != 200:
                return redirect('/login/')

            body = response.json()

            try:
                if body['aud'] != backend.app.config['GOOGLE_CLIENT_ID']:
                    return redirect('/login/')

                if int(body['exp']) < int(time.time()):
                    return redirect('/login/')
                
                email = body['email']

            except KeyError:
                return redirect('/login/')
        return func(email)
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
    flask.session['credentials'] = token
    return redirect('/api/ping/')

@backend.app.route('/api/ping/')
@verify_login
def ping(email):
    return "pong: {}".format(email)
